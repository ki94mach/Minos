"""Unit tests for pure helpers in utils.date_utils."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from utils.date_utils import DateUtils


class TestTimestampRoundTrip:
    def test_to_timestamp_and_back(self) -> None:
        dt = datetime(2024, 6, 15, 12, 30, 45)
        ts = DateUtils.to_timestamp(dt)
        restored = DateUtils.timestamp_to_datetime(ts)
        assert restored.year == dt.year
        assert restored.month == dt.month
        assert restored.day == dt.day
        assert restored.hour == dt.hour
        assert restored.minute == dt.minute
        assert restored.second == dt.second


class TestPersianDateConversion:
    def test_valid_persian_date(self) -> None:
        result = DateUtils.convert_persian_date_to_gregorian("1403/01/01")
        assert isinstance(result, (datetime, date))

    def test_malformed_persian_date_returns_none(self) -> None:
        assert DateUtils.convert_persian_date_to_gregorian("not-a-date") is None
        assert DateUtils.convert_persian_date_to_gregorian("1403/99/99") is None


class TestMillisecondsConversion:
    def test_convert_milliseconds_to_date(self) -> None:
        ms = int(datetime(2024, 1, 1).timestamp() * 1000)
        result = DateUtils.convert_milliseconds_to_date(ms)
        assert isinstance(result, datetime)
        assert result.year == 2024

    def test_zero_ms_returns_none(self) -> None:
        assert DateUtils.convert_milliseconds_to_date(0) is None

    def test_convert_date_to_milliseconds(self) -> None:
        dt = datetime(2024, 1, 1)
        ms = DateUtils.convert_date_to_milliseconds(dt)
        assert isinstance(ms, int)
        assert ms > 0


class TestDayBoundaries:
    def test_start_and_end_of_day(self) -> None:
        dt = datetime(2024, 3, 10, 14, 30, 0)
        start = DateUtils.start_of_day(dt)
        end = DateUtils.end_of_day(dt)
        assert start == datetime(2024, 3, 10, 0, 0, 0)
        assert end == datetime(2024, 3, 10, 23, 59, 59)


class TestAddDays:
    def test_add_positive_days(self) -> None:
        dt = datetime(2024, 1, 1)
        result = DateUtils.add_days(dt, 10)
        assert result == datetime(2024, 1, 11)


class TestDaysBetweenDates:
    def test_positive_delta(self) -> None:
        d1 = datetime(2024, 1, 1)
        d2 = datetime(2024, 1, 11)
        assert DateUtils.days_between_dates(d1, d2) == 10


class TestShamsiYearRange:
    def test_valid_shamsi_year(self) -> None:
        start, end = DateUtils.get_shamsi_year_start_end_in_gregorian(1403)
        assert isinstance(start, (datetime, date))
        assert isinstance(end, (datetime, date))
        assert start < end

    def test_invalid_shamsi_year_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid Shamsi year"):
            DateUtils.get_shamsi_year_start_end_in_gregorian(-1)
