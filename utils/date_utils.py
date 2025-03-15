import calendar
from datetime import datetime, timedelta
from typing import Optional, Tuple
import khayyam


class DateUtils:
    """Utility class for handling date conversions and formatting in Persian calendar."""

    @staticmethod
    def to_persian_date(date: datetime, format_: str = '%Y/%m/%d') -> str:
        return khayyam.JalaliDate(date).strftime(format_)

    @staticmethod
    def to_persian_datetime(date_time: datetime, format_: str = '%Y/%m/%d %H:%M:%S') -> str:
        try:
            return khayyam.JalaliDatetime(date_time).strftime(format_)
        except ValueError:
            return ''

    @staticmethod
    def to_timestamp(date_time: datetime, epoch: datetime = datetime(1970, 1, 1)) -> float:
        td = date_time - epoch
        return (td.microseconds + (td.seconds + td.days * 86400) * 10 ** 6) / 10 ** 6

    @staticmethod
    def timestamp_to_datetime(timestamp: float) -> datetime:
        return datetime.utcfromtimestamp(timestamp)

    @classmethod
    def timestamp_to_persian_date(cls, timestamp: float) -> str:
        datetime_ = cls.timestamp_to_datetime(timestamp)
        return cls.to_persian_date(datetime_)

    @classmethod
    def timestamp_to_persian_datetime(cls, timestamp: float) -> str:
        datetime_ = cls.timestamp_to_datetime(timestamp)
        return cls.to_persian_datetime(datetime_)

    @staticmethod
    def get_today_persian() -> Tuple[str, str]:
        now_ = datetime.now()
        persian_datetime = khayyam.JalaliDatetime(now_)
        month_names = [
            u"فروردین", u"اردیبهشت", u"خرداد", u"تیر", u"مرداد",
            u"شهریور", u"مهر", u"آبان", u"آذر", u"دی", u"بهمن", u"اسفند"
        ]
        month_name = month_names[persian_datetime.date().month - 1]
        return persian_datetime.strftime("%d"), month_name

    @staticmethod
    def convert_persian_date_to_gregorian(persian_date: str) -> Optional[datetime]:
        try:
            y, m, d = map(int, persian_date.split('/'))
            return khayyam.JalaliDatetime(year=y, month=m, day=d).todate()
        except (ValueError, IndexError):
            return None

    @staticmethod
    def convert_milliseconds_to_date(ms: int) -> Optional[datetime]:
        try:
            return datetime.fromtimestamp(ms / 1000.0) if ms else None
        except ValueError:
            return None

    @staticmethod
    def convert_date_to_milliseconds(date: datetime) -> Optional[int]:
        try:
            return calendar.timegm(date.timetuple()) * 1000
        except (OverflowError, TypeError):
            return None

    # Additional Helper Methods

    @staticmethod
    def start_of_day(date_time: datetime) -> datetime:
        return datetime(date_time.year, date_time.month, date_time.day)

    @staticmethod
    def end_of_day(date_time: datetime) -> datetime:
        return datetime(date_time.year, date_time.month, date_time.day, 23, 59, 59)

    @staticmethod
    def add_days(date_time: datetime, days: int) -> datetime:
        return date_time + timedelta(days=days)

    @staticmethod
    def current_persian_datetime(format_: str = '%Y/%m/%d %H:%M:%S') -> str:
        now = datetime.now()
        return DateUtils.to_persian_datetime(now, format_)

    @staticmethod
    def string_to_jalali_date(date_string: str, format_: str = '%Y/%m/%d') -> Optional[datetime]:
        try:
            date_time = datetime.strptime(date_string, format_)
            return khayyam.JalaliDatetime(date_time).todate()
        except ValueError:
            return None

    @staticmethod
    def days_between_dates(date1: datetime, date2: datetime) -> int:
        delta = date2 - date1
        return delta.days

    @staticmethod
    def start_of_persian_year(date: datetime) -> datetime:
        jalali_date = khayyam.JalaliDate(date)
        return khayyam.JalaliDate(jalali_date.year, 1, 1).todate()

    @staticmethod
    def end_of_persian_year(date: datetime) -> datetime:
        jalali_date = khayyam.JalaliDate(date)
        if khayyam.JalaliDate.isleap(jalali_date.year):
            return khayyam.JalaliDate(jalali_date.year, 12, 30).todate()
        return khayyam.JalaliDate(jalali_date.year, 12, 29).todate()

    @staticmethod
    def get_shamsi_year_start_end_in_gregorian(shamsi_year: int) -> Tuple[datetime, datetime]:
        try:
            # Calculate the first day of the Shamsi year
            start_date_shamsi = khayyam.JalaliDate(shamsi_year, 1, 1).todate()

            # Calculate the last day of the Shamsi year
            if khayyam.JalaliDate(shamsi_year, 1, 1).isleap:
                end_date_shamsi = khayyam.JalaliDate(shamsi_year, 12, 30).todate()
            else:
                end_date_shamsi = khayyam.JalaliDate(shamsi_year, 12, 29).todate()

            return start_date_shamsi, end_date_shamsi
        except ValueError:
            raise ValueError(f"Invalid Shamsi year: {shamsi_year}")
