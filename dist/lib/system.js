import os from "os";
import { execa } from "execa";
export async function has(bin) {
    try {
        await execa(bin, ["--version"]);
        return true;
    }
    catch {
        return false;
    }
}
export function platform() {
    const p = os.platform();
    if (p === "darwin")
        return "mac";
    if (p === "win32")
        return "win";
    return "linux";
}
