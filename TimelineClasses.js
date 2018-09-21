class timelinetick {}

timelinetick.TYPE = {
    MS: Symbol(),
    SEC: Symbol(),
    MIN: Symbol(),
    HOUR: Symbol(),
    DAY: Symbol(),
    WEEK: Symbol(),
    MONTH: Symbol()
};

class timelinemarker {}

timelinemarker.TYPE = {
    UNKNOWN_EVENT: Symbol(),
    SIZE_CHANGE: Symbol(),
    ITEM_CREATION: Symbol(),
    ITEM_DELETION: Symbol()
};