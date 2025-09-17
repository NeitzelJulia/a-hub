package org.example.backend.service;

import org.example.backend.exception.WasteImportException;
import org.example.backend.model.waste.WasteEvent;
import org.example.backend.model.waste.WasteEventImportDto;
import org.example.backend.model.waste.WasteNextDto;
import org.example.backend.model.waste.WasteType;
import org.example.backend.repo.WasteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WasteServiceTest {

    @Mock
    WasteRepository repo;

    private WasteService newService() {
        return new WasteService(repo);
    }

    @Test
    void getDtosInWindow_happyPath_mapsAndUsesInclusiveRange() {
        var service = newService();

        LocalDate start = LocalDate.of(2025, 9, 18);
        LocalDate end   = start.plusDays(6);

        var ev1 = new WasteEvent(1L, "u1", start, "Graue Restmülltonne", null, WasteType.RESIDUAL, null);
        var ev2 = new WasteEvent(2L, "u2", LocalDate.of(2025, 9, 22), "Gelbe Tonne", null, WasteType.PLASTIC, null);
        when(repo.getWasteEventsInRange(start, end)).thenReturn(List.of(ev1, ev2));

        List<WasteNextDto> result = service.getDtosInWindow(start, 7);

        verify(repo, times(1)).getWasteEventsInRange(start, end);
        assertEquals(2, result.size());
        assertEquals(new WasteNextDto("2025-09-18", "residual", "Graue Restmülltonne"), result.get(0));
        assertEquals(new WasteNextDto("2025-09-22", "plastic", "Gelbe Tonne"), result.get(1));
    }

    @Test
    void getDtosInWindow_clampsDaysToMax() {
        var service = newService();

        LocalDate start = LocalDate.of(2025, 9, 18);
        LocalDate expectedEnd = start.plusDays(59);

        when(repo.getWasteEventsInRange(eq(start), eq(expectedEnd))).thenReturn(List.of());

        service.getDtosInWindow(start, 999);

        verify(repo, times(1)).getWasteEventsInRange(start, expectedEnd);
    }

    @Test
    void importIcs_happyPath_usesDefaultResource_clearsAndImports() {
        var service = Mockito.spy(newService());

        var items = List.of(
                new WasteEventImportDto("u1", LocalDate.of(2025, 9, 18), "Graue Restmülltonne", null, WasteType.RESIDUAL, null),
                new WasteEventImportDto("u2", LocalDate.of(2025, 9, 22), "Gelbe Tonne", null, WasteType.PLASTIC, null)
        );

        doReturn(items).when(service).loadAndParse("waste-calendar.ics");
        when(repo.importWasteEvents(items)).thenReturn(List.of(10L, 11L));

        int inserted = service.importIcs(null);

        verify(service, times(1)).loadAndParse("waste-calendar.ics");
        verify(repo, times(1)).clearWasteEvents();
        verify(repo, times(1)).importWasteEvents(items);
        assertEquals(2, inserted);
    }

    @Test
    void importIcs_whenLoadFails_throwsAndDoesNotTouchRepo() {
        var service = Mockito.spy(newService());
        doThrow(new WasteImportException("kaputt", null)).when(service).loadAndParse(anyString());

        assertThrows(WasteImportException.class, () -> service.importIcs("classpath:any.ics"));

        verify(repo, never()).clearWasteEvents();
        verify(repo, never()).importWasteEvents(anyList());
    }

    @Test
    void loadAndParse_missingResource_throwsWasteImportException() {
        var service = newService();
        assertThrows(WasteImportException.class, () -> service.loadAndParse("does-not-exist.ics"));
    }
}
