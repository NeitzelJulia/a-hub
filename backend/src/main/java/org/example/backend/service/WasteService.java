package org.example.backend.service;

import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Property;
import org.example.backend.exception.WasteImportException;
import org.example.backend.model.waste.WasteEventImportDto;
import org.example.backend.model.waste.WasteNextDto;
import org.example.backend.model.waste.WasteType;
import org.example.backend.repo.WasteRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.Component;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.DtStart;
import net.fortuna.ical4j.model.property.Uid;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.Temporal;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
public class WasteService {
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Berlin");
    private static final String DEFAULT_RESOURCE = "waste-calendar.ics";

    private final WasteRepository repo;
    private final ZoneId zone;
    private final String defaultResource;

    public WasteService(WasteRepository repo) {
        this.repo = repo;
        this.zone = DEFAULT_ZONE;
        this.defaultResource = DEFAULT_RESOURCE;
    }

    public List<WasteNextDto> getDtosInWindow(LocalDate fromInclusive, int days) {
        int span = Math.clamp(days, 1, 60);
        LocalDate toInclusive = fromInclusive.plusDays(span - 1);

        return repo.getWasteEventsInRange(fromInclusive, toInclusive).stream()
                .map(e -> new WasteNextDto(
                        e.dtstart().toString(),
                        e.type().name().toLowerCase(java.util.Locale.ROOT),
                        e.summary()
                ))
                .toList();
    }

    @Transactional
    public int importIcs() {
        List<WasteEventImportDto> items = loadAndParse(defaultResource);
        repo.clearWasteEvents();
        return repo.importWasteEvents(items).size();
    }

    public List<WasteEventImportDto> loadAndParse(String classpathResource) {
        try (InputStream in = new ClassPathResource(classpathResource).getInputStream()) {
            Calendar cal = new CalendarBuilder().build(in);
            return toImportDtos(cal);
        } catch (java.io.IOException e) {
            throw new WasteImportException("ICS nicht lesbar: " + classpathResource, e);
        } catch (ParserException e) {
            throw new WasteImportException("ICS Parsing-Fehler in: " + classpathResource, e);
        }
    }

    private List<WasteEventImportDto> toImportDtos(Calendar cal) {
        List<WasteEventImportDto> out = new ArrayList<>();
        var events = cal.getComponents(Component.VEVENT);

        for (var comp : events) {
            VEvent ev = (VEvent) comp;

            String summary = ev.getSummary() != null ? ev.getSummary().getValue() : null;

            String description = ev.getDescription() != null ? ev.getDescription().getValue() : null;

            String location = ev.getLocation() != null ? ev.getLocation().getValue() : null;

            String uid = ev.getUid()
                    .map(Uid::getValue)
                    .orElse(null);

            LocalDate date = ev.getProperty(Property.DTSTART)
                    .map(p -> (DtStart<?>) p)
                    .map(DtStart::getDate)
                    .map(this::toLocalDate)
                    .orElse(null);

            if (summary == null || date == null) continue;
            if (uid == null || uid.isBlank()) uid = stableUid(summary, date);

            WasteType type = WasteType.fromText(summary + " " + (description == null ? "" : description));

            out.add(new WasteEventImportDto(uid, date, summary, description, type, location));
        }
        return out;
    }

    private LocalDate toLocalDate(Temporal t) {
        if (t == null) return null;

        if (t instanceof LocalDate ld) {
            return ld;
        }
        if (t instanceof LocalDateTime ldt) {
            return ldt.toLocalDate();
        }
        if (t instanceof ZonedDateTime zdt) {
            return zdt.withZoneSameInstant(zone).toLocalDate();
        }
        if (t instanceof OffsetDateTime odt) {
            return odt.atZoneSameInstant(zone).toLocalDate();
        }
        if (t instanceof Instant inst) {
            return inst.atZone(zone).toLocalDate();
        }

        String s = t.toString();
        if (s != null && s.matches("^\\d{8}$")) { // yyyyMMdd
            return LocalDate.parse(s, DateTimeFormatter.BASIC_ISO_DATE);
        }

        return null;
    }

    private String stableUid(String summary, LocalDate date) {
        String seed = (summary == null ? "" : summary) + "|" + (date != null ? date.toString() : "");
        return Base64.getUrlEncoder().withoutPadding().encodeToString(seed.getBytes(StandardCharsets.UTF_8));
    }
}
