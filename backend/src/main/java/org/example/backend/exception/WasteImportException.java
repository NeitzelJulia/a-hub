package org.example.backend.exception;

public class WasteImportException extends RuntimeException {
    public WasteImportException(String message, Throwable cause) {
        super(message, cause);
    }
}
