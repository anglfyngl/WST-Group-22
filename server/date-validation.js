function isValidCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const calendarDate = new Date(0);
    calendarDate.setUTCFullYear(year, month - 1, day);
    calendarDate.setUTCHours(0, 0, 0, 0);

    return calendarDate.getUTCFullYear() === year &&
        calendarDate.getUTCMonth() === month - 1 &&
        calendarDate.getUTCDate() === day;
}

function getTodayCalendarDate(timeZone) {
    const today = new Date();
    if (timeZone) {
        try {
            const parts = new Intl.DateTimeFormat("en", {
                timeZone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }).formatToParts(today);
            const values = Object.fromEntries(
                parts.map(({ type, value }) => [type, value])
            );
            return `${values.year}-${values.month}-${values.day}`;
        } catch (error) {
            if (!(error instanceof RangeError)) {
                throw error;
            }
        }
    }

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isDateOnOrBeforeToday(value, timeZone) {
    return isValidCalendarDate(value) &&
        value <= getTodayCalendarDate(timeZone);
}

module.exports = { isValidCalendarDate, isDateOnOrBeforeToday };
