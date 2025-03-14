export function trimSlashEnd(str: string) {
    let result = str
    while (result.endsWith('/')) {
        result = result.replace(/\/$/, "");
    }
    return result
}