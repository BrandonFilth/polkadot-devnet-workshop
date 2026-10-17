// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title  Leaderboard
 * @notice Marcador del juego: guarda el mejor puntaje de cada jugador y, si el jugador quiere,
 *         un username único. No tiene dueño: nadie puede borrar ni cambiar puntajes ajenos.
 *
 *         Cada jugador es una dirección (msg.sender). Dentro de la Polkadot App esa dirección es
 *         la cuenta que el Host deriva para el juego, así que es distinta en cada app.
 */
contract Leaderboard {
    // ---------------------------------------------------------------- estado

    /// Mejor puntaje de cada jugador. 0 significa que todavía no ha guardado ninguno.
    mapping(address => uint256) public bestScore;

    /// Username de cada jugador. Vacío si no ha puesto uno.
    mapping(address => string) public usernameOf;

    /// Relación al revés, username -> jugador. Es lo que hace que un username sea único.
    /// La clave es el hash del username para no guardar el texto dos veces.
    mapping(bytes32 => address) private holderOf;

    /// Todos los que han guardado al menos un puntaje, en el orden en que llegaron.
    /// Un mapping no se puede recorrer, así que esta lista es la que permite leerlos todos.
    address[] private players;

    // ---------------------------------------------------------------- eventos

    /// Un jugador subió su récord.
    event NewHighScore(address indexed player, uint256 score);

    /// Un jugador puso o cambió su username.
    event UsernameSet(address indexed player, string username);

    // ---------------------------------------------------------------- errores

    /// El puntaje no supera el récord que ya tienes.
    error ScoreNotHigher(uint256 current, uint256 submitted);

    /// El username debe tener de 3 a 16 caracteres: a-z, 0-9 o _.
    error InvalidUsername();

    /// Otro jugador ya usa ese username.
    error UsernameTaken();

    // ---------------------------------------------------------------- escribir

    /// Guarda tu puntaje si es mejor que tu récord.
    function submitScore(uint256 score) external {
        uint256 current = bestScore[msg.sender];
        if (score <= current) revert ScoreNotHigher(current, score);

        // Primera vez que este jugador guarda un puntaje: entra a la lista.
        if (current == 0) players.push(msg.sender);

        bestScore[msg.sender] = score;
        emit NewHighScore(msg.sender, score);
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

    /// Cuántos jugadores han guardado al menos un puntaje.
    function playerCount() external view returns (uint256) {
        return players.length;
    }

    /// Qué jugador tiene un username. Devuelve 0x000… si nadie lo tiene.
    function playerOf(string calldata username) external view returns (address) {
        return holderOf[keccak256(bytes(username))];
    }

    /**
     * @notice Lee jugadores por páginas, con su username y su mejor puntaje.
     *         Vienen en el orden en que llegaron: la app los ordena de mayor a menor.
     * @param offset Desde qué jugador empezar (0 es el primero).
     * @param limit  Cuántos devolver como máximo.
     */
    function getScores(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory addrs, string[] memory usernames, uint256[] memory scores)
    {
        uint256 total = players.length;
        uint256 n = 0;
        if (offset < total) {
            n = total - offset;
            if (n > limit) n = limit;
        }

        addrs = new address[](n);
        usernames = new string[](n);
        scores = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            address p = players[offset + i];
            addrs[i] = p;
            usernames[i] = usernameOf[p];
            scores[i] = bestScore[p];
        }
    }

    // ---------------------------------------------------------------- interno

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
