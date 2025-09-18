package org.example.backend.model.waste;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WasteTypeTest {

    @Test
    void nullOrBlank_returnsUnknown() {
        assertEquals(WasteType.UNKNOWN, WasteType.fromText(null));
        assertEquals(WasteType.UNKNOWN, WasteType.fromText(""));
        assertEquals(WasteType.UNKNOWN, WasteType.fromText("   "));
    }

    @Test
    void residual_byGrau_or_Rest() {
        assertEquals(WasteType.RESIDUAL, WasteType.fromText("Graue Restmülltonne"));
        assertEquals(WasteType.RESIDUAL, WasteType.fromText("Restabfall"));
    }

    @Test
    void bio_byBio_or_Gruen() {
        assertEquals(WasteType.BIO, WasteType.fromText("Biotonne"));
        assertEquals(WasteType.BIO, WasteType.fromText("Grünabfall"));
    }

    @Test
    void plastic_byGelb_Wertstoff_Kunststoff() {
        assertEquals(WasteType.PLASTIC, WasteType.fromText("Gelbe Tonne"));
        assertEquals(WasteType.PLASTIC, WasteType.fromText("Wertstoffsammlung"));
        assertEquals(WasteType.PLASTIC, WasteType.fromText("Kunststoffverpackungen"));
    }

    @Test
    void paper_byBlau_Papier_Altpapier() {
        assertEquals(WasteType.PAPER, WasteType.fromText("Blaue Altpapiertonne"));
        assertEquals(WasteType.PAPER, WasteType.fromText("Papierabholung"));
        assertEquals(WasteType.PAPER, WasteType.fromText("Altpapier"));
    }

    @Test
    void glass_detected() {
        assertEquals(WasteType.GLASS, WasteType.fromText("Glascontainer"));
    }

    @Test
    void hazardous_detected() {
        assertEquals(WasteType.HAZARDOUS, WasteType.fromText("Schadstoffmobil"));
    }

    @Test
    void caseInsensitivity() {
        assertEquals(WasteType.PLASTIC, WasteType.fromText("GeLbE tOnNe"));
    }
}
