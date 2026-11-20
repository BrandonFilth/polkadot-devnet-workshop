// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title  LeaderboardV5
 * @notice Marcador de Polka-Man por periodos de 3 días, con anti-trampas. Igual que v4 (récord por
 *         periodo, récord de por vida, username único, wallets de premios y pagos registrados), con
 *         cuatro cambios:
 *
 *         1. Puntajes firmados. submitScore solo acepta un puntaje firmado por el Worker anti-trampas
 *            (`signer`), con una firma EIP-712 «esta cuenta hizo X puntos en la partida gameId, válida
 *            hasta deadline». La firma es para quien llama (msg.sender), para este contrato y para esta
 *            red; cada gameId se usa una sola vez. Sin firma no se guarda nada: llamar al contrato
 *            directo con un número inventado revierte.
 *         2. Tope de puntaje (MAX_SCORE): aunque la llave del Worker se filtrara, nadie puede dejar un
 *            récord imposible que nadie más supere.
 *         3. Descalificar: el admin puede quitar a un jugador de un periodo (disqualify). Ya no vuelve
 *            a guardar en ese periodo.
 *         4. Migración desde v4: mientras está abierta, el admin copia puntajes de periodos ya
 *            terminados, perfiles (username y wallet) y premios pagados. closeMigration la cierra para
 *            siempre. El periodo en curso no se importa y el récord de por vida empieza en cero.
 *
 *         Un solo admin (quien despliega). Fuera de la migración y de disqualify, nadie puede escribir
 *         puntajes ajenos.
 */
contract LeaderboardV5 {
    // ---------------------------------------------------------------- constantes

    /// Duración de cada periodo del ranking.
    uint256 public constant PERIOD_LENGTH = 3 days;

    /// Puntaje máximo que se acepta (firmado o importado).
    uint256 public constant MAX_SCORE = 10_000_000;

    /// Rondas con premio (la ronda N es el periodo N-1).
    uint256 public constant PRIZE_ROUNDS = 6;

    /// Lugares con premio por ronda.
    uint256 public constant PRIZE_PLACES = 3;

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant SCORE_TYPEHASH =
        keccak256("Score(address player,uint256 score,bytes32 gameId,uint256 deadline)");

    /// Mitad del orden de secp256k1: una `s` mayor es la otra forma de la misma firma.
    uint256 private constant HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    // ---------------------------------------------------------------- estado

    /// Única dirección que puede fijar la hora de inicio, importar, descalificar, registrar premios,
    /// cambiar el firmante y cambiar de admin.
    address public admin;

    /// Dirección cuyas firmas acepta submitScore (la llave del Worker anti-trampas).
    address public signer;

    /// Hora (Unix, segundos) en que empieza el periodo 0. 0 significa que el admin aún no la fija.
    uint256 public startTime;

    /// true hasta que el admin llama closeMigration.
    bool public migrationOpen = true;

    /// Mejor puntaje de cada jugador en cada periodo. 0 significa que no guardó ninguno en ese periodo.
    mapping(uint256 => mapping(address => uint256)) public scoreOf;

    /// Quiénes guardaron al menos un puntaje en cada periodo, en el orden en que llegaron.
    mapping(uint256 => address[]) private playersIn;

    /// Jugadores descalificados en cada periodo: su puntaje queda en 0 y no pueden volver a guardar ahí.
    mapping(uint256 => mapping(address => bool)) public disqualified;

    /// Partidas (gameId) ya usadas.
    mapping(bytes32 => bool) public usedGame;

    /// Mejor puntaje de cada jugador sumando todos los periodos de v5. Solo sube (salvo disqualify).
    mapping(address => uint256) public lifetimeBest;

    /// Username de cada jugador. Vacío si no ha puesto uno.
    mapping(address => string) public usernameOf;

    /// username -> jugador (clave: hash del username). Es lo que hace que un username sea único.
    mapping(bytes32 => address) private holderOf;

    /// Wallet de premios de cada jugador (dirección EVM). 0x000… si no ha registrado una.
    mapping(address => address) public payoutOf;

    /// Un premio pagado.
    struct Prize {
        address player; // cuenta del jugador en el juego
        address wallet; // wallet a la que se envió el premio
        bytes32 txHash; // hash de la transacción del pago
        uint64 paidAt; // hora (Unix, segundos) en que se registró
    }

    /// Premios por ronda (1 a PRIZE_ROUNDS) y lugar (1 a PRIZE_PLACES).
    mapping(uint256 => mapping(uint256 => Prize)) private prizes;

    // ---------------------------------------------------------------- eventos

    event NewHighScore(address indexed player, uint256 indexed period, uint256 score);
    event NewLifetimeBest(address indexed player, uint256 score);
    event UsernameSet(address indexed player, string username);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event SignerChanged(address indexed previousSigner, address indexed newSigner);
    event StartTimeSet(uint256 start);
    event PayoutWalletSet(address indexed player, address wallet);
    event PrizeRecorded(uint256 indexed round, uint256 indexed place, address indexed player, address wallet, bytes32 txHash);
    /// El admin quitó a un jugador de un periodo.
    event Disqualified(uint256 indexed period, address indexed player, uint256 previousScore);
    /// Se importó una partida de puntajes de v4 (para comprobar la migración).
    event ScoresImported(uint256 indexed period, uint256 count);
    event MigrationClosed();

    // ---------------------------------------------------------------- errores

    error ScoreNotHigher(uint256 current, uint256 submitted);
    error InvalidUsername();
    error UsernameTaken();
    error NotAdmin();
    error InvalidAdmin();
    error InvalidSigner();
    error InvalidStart();
    error StartLocked();
    error NotStarted();
    error InvalidRound();
    error InvalidPlace();
    error InvalidPlayer();
    error InvalidTxHash();
    error NoPayoutWallet();
    /// La firma no es del Worker, o no es para esta cuenta, este puntaje o esta partida.
    error BadSignature();
    /// La firma ya venció (deadline).
    error Expired();
    /// Esa partida ya se guardó.
    error GameUsed();
    /// El puntaje pasa de MAX_SCORE (o es 0).
    error InvalidScore();
    /// El jugador está descalificado en este periodo.
    error IsDisqualified();
    /// La migración ya se cerró.
    error MigrationIsClosed();
    /// Solo se importan periodos ya terminados.
    error PeriodNotFinished();
    /// Listas de distinto largo.
    error LengthMismatch();
    /// Ese jugador ya tiene puntaje en ese periodo.
    error AlreadyImported();

    // ---------------------------------------------------------------- desplegar

    /// Quien despliega queda como admin. `signer_` es la dirección de la llave del Worker.
    constructor(address signer_) {
        if (signer_ == address(0)) revert InvalidSigner();
        admin = msg.sender;
        signer = signer_;
        emit AdminChanged(address(0), msg.sender);
        emit SignerChanged(address(0), signer_);
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier duringMigration() {
        if (msg.sender != admin) revert NotAdmin();
        if (!migrationOpen) revert MigrationIsClosed();
        _;
    }

    // ---------------------------------------------------------------- admin

    /// Le pasa el puesto de admin a `newAdmin`.
    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAdmin();
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /// Cambia la llave del Worker (por ejemplo, si se filtrara). Las firmas de la anterior dejan de valer.
    function setSigner(address newSigner) external onlyAdmin {
        if (newSigner == address(0)) revert InvalidSigner();
        emit SignerChanged(signer, newSigner);
        signer = newSigner;
    }

    /// Fija o cambia la hora de inicio, solo mientras el ranking no haya empezado. Puede ser una hora
    /// pasada: así v5 sigue los mismos periodos que v4.
    function setStartTime(uint256 start) external onlyAdmin {
        if (start == 0) revert InvalidStart();
        if (isStarted()) revert StartLocked();
        startTime = start;
        emit StartTimeSet(start);
    }

    /// Quita a `player` del periodo `p`: su puntaje queda en 0, ya no puede guardar en ese periodo y
    /// su récord de por vida vuelve a 0 (no se puede saber cuál era el bueno).
    function disqualify(uint256 p, address player) external onlyAdmin {
        if (player == address(0)) revert InvalidPlayer();
        uint256 previous = scoreOf[p][player];
        disqualified[p][player] = true;
        scoreOf[p][player] = 0;
        lifetimeBest[player] = 0;
        emit Disqualified(p, player, previous);
    }

    /// Registra el pago del premio de `place` en `round` a `player`, con el hash del envío.
    function recordPrize(uint256 round, uint256 place, address player, bytes32 txHash) external onlyAdmin {
        address wallet = payoutOf[player];
        if (wallet == address(0)) revert NoPayoutWallet();
        storePrize(round, place, player, wallet, txHash, uint64(block.timestamp));
    }

    // ---------------------------------------------------------------- migración desde v4

    /**
     * @notice Copia puntajes de un periodo ya terminado, en el mismo orden en que llegaron en v4 (en
     *         un empate gana quien llegó primero). Se puede llamar varias veces por periodo, por lotes.
     *         No toca el récord de por vida.
     */
    function importScores(uint256 p, address[] calldata players, uint256[] calldata scores) external duringMigration {
        if (players.length != scores.length) revert LengthMismatch();
        if (!isStarted() || p >= currentPeriod()) revert PeriodNotFinished();
        for (uint256 i = 0; i < players.length; i++) {
            address a = players[i];
            uint256 s = scores[i];
            if (a == address(0)) revert InvalidPlayer();
            if (s == 0 || s > MAX_SCORE) revert InvalidScore();
            if (scoreOf[p][a] != 0) revert AlreadyImported();
            scoreOf[p][a] = s;
            playersIn[p].push(a);
            emit NewHighScore(a, p, s);
        }
        emit ScoresImported(p, players.length);
    }

    /// Copia username y wallet de premios. Un username vacío o una wallet 0x000… no se tocan.
    function importProfiles(address[] calldata players, string[] calldata usernames, address[] calldata wallets)
        external
        duringMigration
    {
        if (players.length != usernames.length || players.length != wallets.length) revert LengthMismatch();
        for (uint256 i = 0; i < players.length; i++) {
            address a = players[i];
            if (a == address(0)) revert InvalidPlayer();
            if (bytes(usernames[i]).length != 0) assignUsername(a, usernames[i]);
            if (wallets[i] != address(0)) {
                payoutOf[a] = wallets[i];
                emit PayoutWalletSet(a, wallets[i]);
            }
        }
    }

    /// Copia un premio ya pagado en v4, con su wallet y su hora originales.
    function importPrize(uint256 round, uint256 place, address player, address wallet, bytes32 txHash, uint64 paidAt)
        external
        duringMigration
    {
        if (wallet == address(0)) revert NoPayoutWallet();
        storePrize(round, place, player, wallet, txHash, paidAt);
    }

    /// Cierra la migración para siempre: ya nadie puede importar.
    function closeMigration() external duringMigration {
        migrationOpen = false;
        emit MigrationClosed();
    }

    // ---------------------------------------------------------------- jugadores

    /// Registra o cambia tu wallet de premios (dirección EVM). Con 0x000… la borras.
    function setPayoutWallet(address wallet) external {
        payoutOf[msg.sender] = wallet;
        emit PayoutWalletSet(msg.sender, wallet);
    }

    /**
     * @notice Guarda tu puntaje si es mejor que tu récord del periodo actual. `sig` es la firma del
     *         Worker para (msg.sender, score, gameId, deadline).
     */
    function submitScore(uint256 score, bytes32 gameId, uint256 deadline, bytes calldata sig) external {
        if (!isStarted()) revert NotStarted();
        if (block.timestamp > deadline) revert Expired();
        if (usedGame[gameId]) revert GameUsed();
        if (score == 0 || score > MAX_SCORE) revert InvalidScore();
        if (recover(msg.sender, score, gameId, deadline, sig) != signer) revert BadSignature();

        uint256 p = currentPeriod();
        if (disqualified[p][msg.sender]) revert IsDisqualified();
        uint256 current = scoreOf[p][msg.sender];
        if (score <= current) revert ScoreNotHigher(current, score);

        usedGame[gameId] = true;
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
        assignUsername(msg.sender, username);
    }

    // ---------------------------------------------------------------- leer

    function isStarted() public view returns (bool) {
        return startTime != 0 && block.timestamp >= startTime;
    }

    function currentPeriod() public view returns (uint256) {
        if (!isStarted()) return 0;
        return (block.timestamp - startTime) / PERIOD_LENGTH;
    }

    function periodBounds(uint256 p) external view returns (uint256 startsAt, uint256 endsAt) {
        if (startTime == 0) revert NotStarted();
        startsAt = startTime + p * PERIOD_LENGTH;
        endsAt = startsAt + PERIOD_LENGTH;
    }

    function bestScore(address player) external view returns (uint256) {
        return scoreOf[currentPeriod()][player];
    }

    function playerCount() external view returns (uint256) {
        return playersIn[currentPeriod()].length;
    }

    function playerCountIn(uint256 p) external view returns (uint256) {
        return playersIn[p].length;
    }

    function playerOf(string calldata username) external view returns (address) {
        return holderOf[keccak256(bytes(username))];
    }

    /// Jugadores del periodo actual por páginas (en orden de llegada). Un descalificado sale con 0.
    function getScores(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addrs, string[] memory usernames, uint256[] memory scores)
    {
        return page(currentPeriod(), offset, limit);
    }

    function getScoresIn(uint256 p, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addrs, string[] memory usernames, uint256[] memory scores)
    {
        return page(p, offset, limit);
    }

    function payoutsOf(address[] calldata players) external view returns (address[] memory wallets) {
        wallets = new address[](players.length);
        for (uint256 i = 0; i < players.length; i++) wallets[i] = payoutOf[players[i]];
    }

    function prizeAmount(uint256 place) external pure returns (uint256) {
        checkPlace(place);
        if (place == 1) return 8;
        if (place == 2) return 5;
        return 3;
    }

    function prizeOf(uint256 round, uint256 place) external view returns (Prize memory) {
        checkRound(round);
        checkPlace(place);
        return prizes[round][place];
    }

    function prizesOf(uint256 round) external view returns (Prize[] memory list) {
        checkRound(round);
        list = new Prize[](PRIZE_PLACES);
        for (uint256 i = 0; i < PRIZE_PLACES; i++) list[i] = prizes[round][i + 1];
    }

    /// Separador del dominio EIP-712 («PolkaManScore», versión «1», esta red y este contrato).
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("PolkaManScore"), keccak256("1"), block.chainid, address(this))
        );
    }

    /// Hash EIP-712 que firma el Worker.
    function scoreDigest(address player, uint256 score, bytes32 gameId, uint256 deadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(SCORE_TYPEHASH, player, score, gameId, deadline));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    // ---------------------------------------------------------------- interno

    /// Quién firmó. 0x000… si la firma no tiene 65 bytes o no es válida (incluida la forma maleable).
    function recover(address player, uint256 score, bytes32 gameId, uint256 deadline, bytes calldata sig)
        private
        view
        returns (address)
    {
        if (sig.length != 65) return address(0);
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) return address(0);
        return ecrecover(scoreDigest(player, score, gameId, deadline), v, r, s);
    }

    function assignUsername(address who, string calldata username) private {
        bytes memory name = bytes(username);
        if (!isValid(name)) revert InvalidUsername();
        bytes32 key = keccak256(name);
        address holder = holderOf[key];
        if (holder != address(0) && holder != who) revert UsernameTaken();
        bytes memory previous = bytes(usernameOf[who]);
        if (previous.length != 0) delete holderOf[keccak256(previous)];
        holderOf[key] = who;
        usernameOf[who] = username;
        emit UsernameSet(who, username);
    }

    function storePrize(uint256 round, uint256 place, address player, address wallet, bytes32 txHash, uint64 paidAt)
        private
    {
        checkRound(round);
        checkPlace(place);
        if (player == address(0)) revert InvalidPlayer();
        if (txHash == bytes32(0)) revert InvalidTxHash();
        prizes[round][place] = Prize(player, wallet, txHash, paidAt);
        emit PrizeRecorded(round, place, player, wallet, txHash);
    }

    function checkRound(uint256 round) private pure {
        if (round == 0 || round > PRIZE_ROUNDS) revert InvalidRound();
    }

    function checkPlace(uint256 place) private pure {
        if (place == 0 || place > PRIZE_PLACES) revert InvalidPlace();
    }

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

    /// 3 a 16 caracteres, solo a-z, 0-9 y _.
    function isValid(bytes memory name) private pure returns (bool) {
        if (name.length < 3 || name.length > 16) return false;
        for (uint256 i = 0; i < name.length; i++) {
            bytes1 c = name[i];
            bool ok = (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x5f;
            if (!ok) return false;
        }
        return true;
    }
}
