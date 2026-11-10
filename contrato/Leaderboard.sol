// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title  Leaderboard
 * @notice Marcador del juego por periodos de 3 días: guarda el mejor puntaje de cada jugador en
 *         cada periodo, su récord de por vida y, si el jugador quiere, un username único.
 *
 *         Tiene un solo admin (al desplegar, quien despliega). El admin solo puede fijar la hora
 *         de inicio del ranking, registrar el pago de los premios y pasarle el puesto a otra
 *         dirección. Nadie, ni el admin, puede borrar ni cambiar puntajes ajenos.
 *
 *         Premios: cada jugador registra la wallet EVM donde quiere recibir USDT. Por ronda (un
 *         periodo de 3 días; la ronda N es el periodo N-1) el 1.º recibe 8 USDT, el 2.º 5 y el 3.º
 *         3, durante 6 rondas. El admin los envía a mano y deja constancia pública con el hash de
 *         la transacción (recordPrize). Cualquiera puede leer los ganadores y comprobar el pago.
 *
 *         Hasta que llega la hora de inicio no se guarda ningún puntaje. El admin puede cambiar
 *         esa hora mientras no haya llegado; una vez que llega, ya no se puede cambiar.
 *
 *         El ranking se reinicia solo cada 3 días: el periodo actual sale de la hora del bloque,
 *         así que no hace falta que nadie llame una función para reiniciarlo. Los periodos
 *         anteriores quedan guardados y se pueden leer como historial.
 *
 *         Cada jugador es una dirección (msg.sender). Dentro de la Polkadot App esa dirección es
 *         la cuenta que el Host deriva para el juego, así que es distinta en cada app.
 */
contract Leaderboard {
    // ---------------------------------------------------------------- estado

    /// Duración de cada periodo del ranking.
    uint256 public constant PERIOD_LENGTH = 3 days;

    /// Única dirección que puede fijar la hora de inicio, registrar premios y cambiar de admin.
    address public admin;

    /// Hora (Unix, segundos) en que empieza el periodo 0. 0 significa que el admin aún no la fija.
    uint256 public startTime;

    /// Mejor puntaje de cada jugador en cada periodo. 0 significa que no guardó ninguno en ese periodo.
    mapping(uint256 => mapping(address => uint256)) public scoreOf;

    /// Quiénes guardaron al menos un puntaje en cada periodo, en el orden en que llegaron.
    /// Un mapping no se puede recorrer, así que estas listas son las que permiten leerlos todos.
    mapping(uint256 => address[]) private playersIn;

    /// Mejor puntaje de cada jugador sumando todos los periodos. Solo sube.
    mapping(address => uint256) public lifetimeBest;

    /// Username de cada jugador. Vacío si no ha puesto uno. Es el mismo en todos los periodos.
    mapping(address => string) public usernameOf;

    /// Relación al revés, username -> jugador. Es lo que hace que un username sea único.
    /// La clave es el hash del username para no guardar el texto dos veces.
    mapping(bytes32 => address) private holderOf;

    /// Rondas con premio (la ronda N es el periodo N-1).
    uint256 public constant PRIZE_ROUNDS = 6;

    /// Lugares con premio por ronda.
    uint256 public constant PRIZE_PLACES = 3;

    /// Wallet de premios de cada jugador (dirección EVM). 0x000… si no ha registrado una.
    mapping(address => address) public payoutOf;

    /// Un premio pagado.
    struct Prize {
        address player; // cuenta del jugador en el juego
        address wallet; // wallet a la que se envió el premio
        bytes32 txHash; // hash de la transacción del pago
        uint64 paidAt; // hora (Unix, segundos) en que el admin lo registró
    }

    /// Premios por ronda (1 a PRIZE_ROUNDS) y lugar (1 a PRIZE_PLACES).
    mapping(uint256 => mapping(uint256 => Prize)) private prizes;

    // ---------------------------------------------------------------- eventos

    /// Un jugador subió su récord del periodo.
    event NewHighScore(address indexed player, uint256 indexed period, uint256 score);

    /// Un jugador subió su récord de por vida.
    event NewLifetimeBest(address indexed player, uint256 score);

    /// Un jugador puso o cambió su username.
    event UsernameSet(address indexed player, string username);

    /// El admin le pasó el puesto a otra dirección.
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /// El admin fijó o cambió la hora de inicio del ranking.
    event StartTimeSet(uint256 start);

    /// Un jugador registró, cambió o borró su wallet de premios.
    event PayoutWalletSet(address indexed player, address wallet);

    /// El admin registró el pago de un premio.
    event PrizeRecorded(uint256 indexed round, uint256 indexed place, address indexed player, address wallet, bytes32 txHash);

    // ---------------------------------------------------------------- errores

    /// El puntaje no supera el récord que ya tienes en este periodo.
    error ScoreNotHigher(uint256 current, uint256 submitted);

    /// El username debe tener de 3 a 16 caracteres: a-z, 0-9 o _.
    error InvalidUsername();

    /// Otro jugador ya usa ese username.
    error UsernameTaken();

    /// Solo el admin puede llamar esta función.
    error NotAdmin();

    /// El nuevo admin no puede ser la dirección 0x000…: el puesto quedaría perdido.
    error InvalidAdmin();

    /// La hora de inicio no puede ser 0.
    error InvalidStart();

    /// El ranking ya empezó: la hora de inicio ya no se puede cambiar.
    error StartLocked();

    /// El ranking todavía no empieza (no hay hora de inicio o aún no llega).
    error NotStarted();

    /// La ronda de premios debe ser de 1 a PRIZE_ROUNDS.
    error InvalidRound();

    /// El lugar del premio debe ser de 1 a PRIZE_PLACES.
    error InvalidPlace();

    /// El jugador no puede ser la dirección 0x000….
    error InvalidPlayer();

    /// El hash de la transacción no puede ser 0.
    error InvalidTxHash();

    /// El jugador no tiene wallet de premios registrada.
    error NoPayoutWallet();

    // ---------------------------------------------------------------- desplegar

    /// Quien despliega queda como admin.
    constructor() {
        admin = msg.sender;
        emit AdminChanged(address(0), msg.sender);
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ---------------------------------------------------------------- admin

    /// Le pasa el puesto de admin a `newAdmin`. El admin actual deja de serlo.
    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAdmin();
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /// Fija o cambia la hora (Unix, segundos) de inicio. Solo mientras el ranking no haya empezado.
    /// Puede ser una hora pasada o la actual: en ese caso el ranking abre de inmediato.
    function setStartTime(uint256 start) external onlyAdmin {
        if (start == 0) revert InvalidStart();
        if (isStarted()) revert StartLocked();
        startTime = start;
        emit StartTimeSet(start);
    }

    /**
     * @notice Registra el pago del premio de `place` en `round` a `player`, con el hash del envío.
     *         Guarda la wallet que el jugador tiene registrada en este momento. Se puede volver a
     *         llamar para corregir un registro. La ronda N es el periodo N-1.
     */
    function recordPrize(uint256 round, uint256 place, address player, bytes32 txHash) external onlyAdmin {
        checkRound(round);
        checkPlace(place);
        if (player == address(0)) revert InvalidPlayer();
        if (txHash == bytes32(0)) revert InvalidTxHash();
        address wallet = payoutOf[player];
        if (wallet == address(0)) revert NoPayoutWallet();

        prizes[round][place] = Prize(player, wallet, txHash, uint64(block.timestamp));
        emit PrizeRecorded(round, place, player, wallet, txHash);
    }

    // ---------------------------------------------------------------- escribir

    /// Registra o cambia tu wallet de premios (dirección EVM). Con 0x000… la borras.
    function setPayoutWallet(address wallet) external {
        payoutOf[msg.sender] = wallet;
        emit PayoutWalletSet(msg.sender, wallet);
    }

    /// Guarda tu puntaje si es mejor que tu récord del periodo actual.
    function submitScore(uint256 score) external {
        if (!isStarted()) revert NotStarted();
        uint256 p = currentPeriod();
        uint256 current = scoreOf[p][msg.sender];
        if (score <= current) revert ScoreNotHigher(current, score);

        // Primera vez que este jugador guarda un puntaje en este periodo: entra a la lista.
        if (current == 0) playersIn[p].push(msg.sender);

        scoreOf[p][msg.sender] = score;
        emit NewHighScore(msg.sender, p, score);

        if (score > lifetimeBest[msg.sender]) {
            lifetimeBest[msg.sender] = score;
            emit NewLifetimeBest(msg.sender, score);
        }
    }

    /// Pone o cambia tu username. Si cambias, el anterior queda libre para otro jugador.
    function setUsername(string calldata username) external {
        bytes memory name = bytes(username);
        if (!isValid(name)) revert InvalidUsername();

        bytes32 key = keccak256(name);
        address holder = holderOf[key];
        if (holder != address(0) && holder != msg.sender) revert UsernameTaken();

        // Libera el username anterior, si había uno.
        bytes memory previous = bytes(usernameOf[msg.sender]);
        if (previous.length != 0) delete holderOf[keccak256(previous)];

        holderOf[key] = msg.sender;
        usernameOf[msg.sender] = username;
        emit UsernameSet(msg.sender, username);
    }

    // ---------------------------------------------------------------- leer

    /// true si hay hora de inicio y ya llegó. Antes de eso submitScore revierte con NotStarted.
    function isStarted() public view returns (bool) {
        return startTime != 0 && block.timestamp >= startTime;
    }

    /// Número del periodo actual. El primero es el 0. Antes del inicio también devuelve 0
    /// (usa isStarted para distinguirlo); ese periodo está vacío porque no se pudo guardar nada.
    function currentPeriod() public view returns (uint256) {
        if (!isStarted()) return 0;
        return (block.timestamp - startTime) / PERIOD_LENGTH;
    }

    /// Cuándo empieza y cuándo termina el periodo `p` (Unix, segundos). `endsAt` ya es del siguiente.
    /// Revierte con NotStarted si el admin aún no fija la hora de inicio.
    function periodBounds(uint256 p) external view returns (uint256 startsAt, uint256 endsAt) {
        if (startTime == 0) revert NotStarted();
        startsAt = startTime + p * PERIOD_LENGTH;
        endsAt = startsAt + PERIOD_LENGTH;
    }

    /// Mejor puntaje de un jugador en el periodo actual.
    function bestScore(address player) external view returns (uint256) {
        return scoreOf[currentPeriod()][player];
    }

    /// Cuántos jugadores han guardado al menos un puntaje en el periodo actual.
    function playerCount() external view returns (uint256) {
        return playersIn[currentPeriod()].length;
    }

    /// Cuántos jugadores guardaron al menos un puntaje en el periodo `p`.
    function playerCountIn(uint256 p) external view returns (uint256) {
        return playersIn[p].length;
    }

    /// Qué jugador tiene un username. Devuelve 0x000… si nadie lo tiene.
    function playerOf(string calldata username) external view returns (address) {
        return holderOf[keccak256(bytes(username))];
    }

    /**
     * @notice Lee jugadores del periodo actual por páginas, con su username y su mejor puntaje.
     *         Vienen en el orden en que llegaron: la app los ordena de mayor a menor.
     * @param offset Desde qué jugador empezar (0 es el primero).
     * @param limit  Cuántos devolver como máximo.
     */
    function getScores(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addrs, string[] memory usernames, uint256[] memory scores)
    {
        return page(currentPeriod(), offset, limit);
    }

    /// Igual que getScores, pero de un periodo `p` cualquiera (sirve para el historial).
    function getScoresIn(uint256 p, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addrs, string[] memory usernames, uint256[] memory scores)
    {
        return page(p, offset, limit);
    }

    /// Wallets de premios de varios jugadores a la vez (para el ranking). 0x000… si no tienen.
    function payoutsOf(address[] calldata players) external view returns (address[] memory wallets) {
        wallets = new address[](players.length);
        for (uint256 i = 0; i < players.length; i++) wallets[i] = payoutOf[players[i]];
    }

    /// Monto del premio de `place`, en USDT enteros: 8, 5 y 3.
    function prizeAmount(uint256 place) external pure returns (uint256) {
        checkPlace(place);
        if (place == 1) return 8;
        if (place == 2) return 5;
        return 3;
    }

    /// El premio de `place` en `round`. Vacío (player 0x000…) si todavía no se registra.
    function prizeOf(uint256 round, uint256 place) external view returns (Prize memory) {
        checkRound(round);
        checkPlace(place);
        return prizes[round][place];
    }

    /// Los PRIZE_PLACES premios de `round`, del 1.º al 3.º.
    function prizesOf(uint256 round) external view returns (Prize[] memory list) {
        checkRound(round);
        list = new Prize[](PRIZE_PLACES);
        for (uint256 i = 0; i < PRIZE_PLACES; i++) list[i] = prizes[round][i + 1];
    }

    // ---------------------------------------------------------------- interno

    function checkRound(uint256 round) private pure {
        if (round == 0 || round > PRIZE_ROUNDS) revert InvalidRound();
    }

    function checkPlace(uint256 place) private pure {
        if (place == 0 || place > PRIZE_PLACES) revert InvalidPlace();
    }

    /// Una página de jugadores del periodo `p`.
    function page(uint256 p, uint256 offset, uint256 limit)
        private
        view
        returns (address[] memory addrs, string[] memory usernames, uint256[] memory scores)
    {
        address[] storage list = playersIn[p];
        uint256 total = list.length;
        uint256 n = 0;
        if (offset < total) {
            n = total - offset;
            if (n > limit) n = limit;
        }

        addrs = new address[](n);
        usernames = new string[](n);
        scores = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            address a = list[offset + i];
            addrs[i] = a;
            usernames[i] = usernameOf[a];
            scores[i] = scoreOf[p][a];
        }
    }

    /// 3 a 16 caracteres, solo a-z, 0-9 y _. Así no hay usernames vacíos, con espacios o con
    /// mayúsculas que parezcan otro ("Ana" y "ana").
    function isValid(bytes memory name) private pure returns (bool) {
        if (name.length < 3 || name.length > 16) return false;
        for (uint256 i = 0; i < name.length; i++) {
            bytes1 c = name[i];
            bool ok = (c >= 0x61 && c <= 0x7a) // a-z
                || (c >= 0x30 && c <= 0x39) // 0-9
                || c == 0x5f; // _
            if (!ok) return false;
        }
        return true;
    }
}
