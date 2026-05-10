"""Skill XP curve sanity — must match OSRS table at known points."""
import pytest

from shared.schemas import (
    MAX_LEVEL,
    MAX_XP,
    SkillBook,
    SkillKind,
    SkillState,
    level_for_xp,
    xp_for_level,
)


@pytest.mark.parametrize(
    "level,expected",
    [
        (1, 0),
        (2, 83),
        (10, 1_154),
        (50, 101_333),
        (75, 1_210_421),
        (99, 13_034_431),
    ],
)
def test_xp_for_level_matches_osrs(level, expected):
    assert xp_for_level(level) == expected


def test_xp_curve_monotonic():
    prev = -1
    for L in range(1, MAX_LEVEL + 1):
        x = xp_for_level(L)
        assert x > prev
        prev = x


def test_level_for_xp_round_trip():
    for L in range(1, MAX_LEVEL + 1):
        x = xp_for_level(L)
        assert level_for_xp(x) == L
        if x + 1 < MAX_XP:
            assert level_for_xp(x + 1) == L
        if L > 1:
            # one xp below the level-L threshold should be level L-1
            assert level_for_xp(x - 1) == L - 1


def test_level_caps_at_99():
    assert level_for_xp(MAX_XP) == 99
    assert level_for_xp(MAX_XP + 100_000) == 99


def test_skill_book_grant():
    sb = SkillBook.fresh()
    assert sb.total_level == len(SkillKind)  # 6
    before, after = sb.grant_xp(SkillKind.WOODCUTTING, 100)
    assert before == 1
    assert after == 2  # 100 xp >= 83 (lv2 threshold)
    assert sb.get(SkillKind.WOODCUTTING).level == 2
    assert sb.total_level == len(SkillKind) + 1


def test_skill_book_caps_at_max():
    sb = SkillBook.fresh()
    sb.grant_xp(SkillKind.FISHING, MAX_XP * 10)
    assert sb.get(SkillKind.FISHING).xp == MAX_XP
    assert sb.get(SkillKind.FISHING).level == 99


def test_skill_state_xp_into_level_zero_at_threshold():
    s = SkillState(xp=xp_for_level(20))
    assert s.level == 20
    assert s.xp_into_level == 0
