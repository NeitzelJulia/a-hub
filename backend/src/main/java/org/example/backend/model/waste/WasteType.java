package org.example.backend.model.waste;

public enum WasteType {
    PAPER, RESIDUAL, BIO, PLASTIC, GLASS, HAZARDOUS, UNKNOWN;

    public static WasteType fromText(String text) {
        if (text == null || text.isBlank()) return UNKNOWN;
        var s = text.toLowerCase();

        if (s.contains("grau") || s.contains("rest")) return RESIDUAL;
        if (s.contains("bio")  || s.contains("grün")) return BIO;
        if (s.contains("gelb") || s.contains("wertstoff") || s.contains("kunststoff")) return PLASTIC;
        if (s.contains("blau") || s.contains("papier")    || s.contains("altpapier"))  return PAPER;
        if (s.contains("glas")) return GLASS;
        if (s.contains("schadstoff")) return HAZARDOUS;

        return UNKNOWN;
    }
}
