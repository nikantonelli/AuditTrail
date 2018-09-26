class timelinemarker {}

timelinemarker.TYPE = {
    UNKNOWN_EVENT: Symbol(),
//Equivalent to LBAPI record types for now
    ITEM_CREATION: Symbol(),
    ITEM_DELETION: Symbol(),
    ITEM_RESTORE: Symbol(),
    ITEM_UPDATE: Symbol(),
//These are used to indicate condition to the auditor
    NORMAL: Symbol(),
    WARNING: Symbol(),
    ERROR: Symbol(),
};