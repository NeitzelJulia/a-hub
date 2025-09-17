package org.example.backend.service;

import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.Description;
import net.fortuna.ical4j.model.property.DtStart;
import net.fortuna.ical4j.model.property.Location;
import net.fortuna.ical4j.model.property.Summary;
import net.fortuna.ical4j.model.property.Uid;
import org.example.backend.exception.WasteImportException;
import org.example.backend.model.waste.WasteEvent;
import org.example.backend.model.waste.WasteEventImportDto;
import org.example.backend.model.waste.WasteNextDto;
import org.example.backend.model.waste.WasteType;
import org.example.backend.repo.WasteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.Base64;
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

    private Method toLocalDateMethod;
    private Method toImportDtosMethod;

    @BeforeEach
    void setupReflection() throws Exception {
        toLocalDateMethod = WasteService.class.getDeclaredMethod("toLocalDate", java.time.temporal.Temporal.class);
        toLocalDateMethod.setAccessible(true);

        toImportDtosMethod = WasteService.class.getDeclaredMethod("toImportDtos", Calendar.class);
        toImportDtosMethod.setAccessible(true);
    }

    private LocalDate callToLocalDate(Object temporal) {
        try {
            return (LocalDate) toLocalDateMethod.invoke(newService(), temporal);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<WasteEventImportDto> callToImportDtos(Calendar cal) {
        try {
            return (List<WasteEventImportDto>) toImportDtosMethod.invoke(newService(), cal);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
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

    @Test
    void toLocalDate_returnsNullForNull() {
        assertNull(callToLocalDate(null));
    }

    @Test
    void toLocalDate_acceptsLocalDate() {
        var d = LocalDate.of(2025, 9, 18);
        assertEquals(d, callToLocalDate(d));
    }

    @Test
    void toLocalDate_fromLocalDateTime() {
        var ldt = LocalDateTime.of(2025, 9, 18, 10, 30);
        assertEquals(LocalDate.of(2025, 9, 18), callToLocalDate(ldt));
    }

    @Test
    void toLocalDate_fromZonedDateTime_convertsToEuropeBerlin() {
        // 2025-09-21T22:30Z -> Europe/Berlin (CEST, +2) = 2025-09-22T00:30 -> 2025-09-22
        var zdtUtc = ZonedDateTime.of(2025, 9, 21, 22, 30, 0, 0, ZoneOffset.UTC);
        assertEquals(LocalDate.of(2025, 9, 22), callToLocalDate(zdtUtc));
    }

    @Test
    void toLocalDate_fromOffsetDateTime_convertsToEuropeBerlin() {
        var odt = OffsetDateTime.of(2025, 9, 21, 22, 30, 0, 0, ZoneOffset.UTC);
        assertEquals(LocalDate.of(2025, 9, 22), callToLocalDate(odt));
    }

    @Test
    void toLocalDate_fromInstant_convertsToEuropeBerlin() {
        var inst = Instant.parse("2025-09-21T22:30:00Z");
        assertEquals(LocalDate.of(2025, 9, 22), callToLocalDate(inst));
    }

    @Test
    void toImportDtos_mapsEvents_generatesFallbackUid_andSkipsInvalid() {
        var cal = new Calendar();

        var e1 = new VEvent();
        e1.add(new Summary("Gelbe Tonne"));
        e1.add(new Description("Verpackungen"));
        e1.add(new Location("Musterstraße 1"));
        e1.add(new DtStart<>(LocalDate.of(2025, 9, 22)));
        e1.add(new Uid("uid-1"));
        cal.add(e1);

        var e2 = new VEvent();
        e2.add(new Summary("Blaue Altpapiertonne"));
        var zdtUtc = ZonedDateTime.of(2025, 9, 21, 22, 30, 0, 0, ZoneOffset.UTC);
        e2.add(new DtStart<>(zdtUtc));
        cal.add(e2);

        var e3 = new VEvent();
        e3.add(new DtStart<>(LocalDate.of(2025, 9, 23)));
        cal.add(e3);

        var result = callToImportDtos(cal);

        assertEquals(2, result.size());

        var r1 = result.get(0);
        assertEquals("uid-1", r1.uid());
        assertEquals(LocalDate.of(2025, 9, 22), r1.dtstart());
        assertEquals("Gelbe Tonne", r1.summary());
        assertEquals("Verpackungen", r1.description());
        assertEquals("Musterstraße 1", r1.location());
        assertEquals(WasteType.PLASTIC, r1.type()); // Gelb -> plastic

        var r2 = result.get(1);
        assertNotNull(r2.uid());
        assertEquals(LocalDate.of(2025, 9, 22), r2.dtstart());
        assertEquals("Blaue Altpapiertonne", r2.summary());
        assertNull(r2.description());
        assertNull(r2.location());
        assertEquals(WasteType.PAPER, r2.type());

        String seed = "Blaue Altpapiertonne|2025-09-22";
        String expectedUid = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(seed.getBytes(StandardCharsets.UTF_8));
        assertEquals(expectedUid, r2.uid());
    }
}
