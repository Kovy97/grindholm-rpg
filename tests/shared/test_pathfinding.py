"""8-neighbour A* + string-pull continuous pathfinding."""
import math

from server.game.pathfinding import (
    a_star_8,
    find_path,
    has_line_of_sight,
    string_pull,
)


def open_grid(walls=None, w=20, h=20):
    walls = set(walls or [])

    def walkable(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return False
        return (x, y) not in walls

    return walkable


def test_straight_line_path():
    walkable = open_grid()
    path = a_star_8((0, 0), (5, 0), walkable)
    assert path == [(1, 0), (2, 0), (3, 0), (4, 0), (5, 0)]


def test_diagonal_uses_diagonal_steps():
    walkable = open_grid()
    path = a_star_8((0, 0), (3, 3), walkable)
    # 8-neighbour optimal is 3 diagonal steps, not 6 manhattan
    assert len(path) == 3
    assert path[-1] == (3, 3)


def test_no_corner_cutting():
    walls = {(2, 1)}
    walkable = open_grid(walls)
    # Path from (1,1) to (3,1): direct cardinal blocked at (2,1).
    # 8-neighbour MUST go around — diagonal cut through (2,0) requires both
    # (1,0) and (2,1) walkable; the latter is blocked, so corner-cut is denied.
    path = a_star_8((1, 1), (3, 1), walkable)
    assert path
    for step in path:
        assert step not in walls


def test_path_around_wall_strip():
    walls = {(2, 0), (2, 1), (2, 2)}
    walkable = open_grid(walls)
    path = a_star_8((0, 1), (4, 1), walkable)
    assert path
    for step in path:
        assert step not in walls


def test_no_path_returns_empty():
    walls = {(0, 1), (1, 0), (1, 1)}
    walkable = open_grid(walls)
    path = a_star_8((0, 0), (10, 10), walkable)
    assert path == []


def test_goal_blocked_snaps_to_neighbour():
    walls = {(5, 5)}
    walkable = open_grid(walls)
    path = a_star_8((0, 5), (5, 5), walkable)
    assert path
    end = path[-1]
    assert abs(end[0] - 5) + abs(end[1] - 5) == 1


def test_string_pull_collapses_straight_corridor():
    walkable = open_grid()
    raw = a_star_8((0, 0), (10, 0), walkable)
    pulled = string_pull(raw, walkable, start_xy=(0.5, 0.5))
    # Open corridor — should collapse to a single waypoint at the goal
    assert len(pulled) == 1
    assert math.isclose(pulled[0][0], 10.5, abs_tol=0.01)
    assert math.isclose(pulled[0][1], 0.5, abs_tol=0.01)


def test_string_pull_keeps_corner_around_obstacle():
    walls = {(5, 5), (5, 6), (5, 7)}
    walkable = open_grid(walls)
    raw = a_star_8((0, 6), (10, 6), walkable)
    pulled = string_pull(raw, walkable, start_xy=(0.5, 6.5))
    # Must have at least 2 waypoints — one corner before the wall, the goal after
    assert len(pulled) >= 2


def test_line_of_sight_open():
    walkable = open_grid()
    assert has_line_of_sight(0.5, 0.5, 9.5, 0.5, walkable)


def test_line_of_sight_blocked():
    walls = {(5, 0)}
    walkable = open_grid(walls)
    assert not has_line_of_sight(0.5, 0.5, 9.5, 0.5, walkable)


def test_find_path_returns_continuous_floats():
    walkable = open_grid()
    path = find_path((0.5, 0.5), (5, 5), walkable)
    assert path
    for x, y in path:
        # tile-space, with fractional centres
        assert 0 <= x <= 20
        assert 0 <= y <= 20
        # at least one of x or y should be a fractional 0.5 (centre)
        assert (x % 1 == 0.5) or (y % 1 == 0.5)


def test_zero_length_when_already_at_goal():
    walkable = open_grid()
    path = a_star_8((3, 3), (3, 3), walkable)
    assert path == []
