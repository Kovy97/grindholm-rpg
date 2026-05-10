"""A* pathfinding sanity."""
from server.game.pathfinding import a_star


def open_grid(walls=None):
    walls = set(walls or [])

    def walkable(x, y):
        if x < 0 or y < 0 or x >= 20 or y >= 20:
            return False
        return (x, y) not in walls

    return walkable


def test_straight_line_path():
    walkable = open_grid()
    path = a_star((0, 0), (5, 0), walkable)
    assert path == [(1, 0), (2, 0), (3, 0), (4, 0), (5, 0)]


def test_diagonal_via_4neighbour():
    walkable = open_grid()
    path = a_star((0, 0), (3, 2), walkable)
    assert len(path) == 5  # Manhattan distance


def test_path_around_wall():
    walls = {(2, 0), (2, 1), (2, 2)}
    walkable = open_grid(walls)
    path = a_star((0, 1), (4, 1), walkable)
    assert path  # exists
    # cannot pass through walls
    for step in path:
        assert step not in walls


def test_no_path_returns_empty():
    walls = {(0, 1), (1, 0), (1, 1)}
    walkable = open_grid(walls)
    path = a_star((0, 0), (10, 10), walkable)
    assert path == []


def test_goal_is_blocked_snaps_to_neighbour():
    walls = {(5, 5)}
    walkable = open_grid(walls)
    path = a_star((0, 5), (5, 5), walkable)
    # path should end at a tile adjacent to (5, 5) since the goal itself is blocked
    assert path
    end = path[-1]
    assert abs(end[0] - 5) + abs(end[1] - 5) == 1


def test_zero_length_when_already_at_goal():
    walkable = open_grid()
    path = a_star((3, 3), (3, 3), walkable)
    assert path == []
