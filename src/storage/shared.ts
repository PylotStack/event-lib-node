export class InvalidSequenceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidSequenceError";
    }
}