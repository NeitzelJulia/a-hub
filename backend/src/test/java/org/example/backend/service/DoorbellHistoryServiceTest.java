package org.example.backend.service;

import org.example.backend.model.doorbell.DoorbellEvent;
import org.example.backend.repo.DoorbellEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoorbellHistoryServiceTest {

    @Mock
    DoorbellEventRepository repo;

    @InjectMocks
    DoorbellHistoryService service;

    @Test
    void createEvent_happyPath_returnsPersistedEntity() {
        when(repo.createEvent(anyLong())).thenReturn(123L);
        var persisted = new DoorbellEvent(123L, 1111L, false, 0);
        when(repo.findById(123L)).thenReturn(Optional.of(persisted));

        var result = service.createEvent();

        verify(repo, times(1)).createEvent(anyLong());
        verify(repo, times(1)).findById(123L);
        assertEquals(persisted, result);
    }

    @Test
    void createEvent_fallback_whenEntityNotFound_returnsMinimalRecord() {
        when(repo.createEvent(anyLong())).thenReturn(7L);
        when(repo.findById(7L)).thenReturn(Optional.empty());

        var result = service.createEvent();

        assertEquals(7L, result.id());
        assertNull(result.occurredAtMillis());
        assertNull(result.answered());
        assertNull(result.talkSeconds());
    }

    @Test
    void markAnswered_delegatesToRepo() {
        service.markAnswered(9L);
        verify(repo, times(1)).markAnswered(9L);
    }

    @Test
    void finish_delegatesToRepo() {
        service.finish(9L, 12);
        verify(repo, times(1)).finalizeTalk(9L, 12);
    }

    @Test
    void latest_returnsRepoResult() {
        var list = List.of(
                new DoorbellEvent(1L, 1000L, true, 5),
                new DoorbellEvent(2L, 2000L, false, 0)
        );
        when(repo.findLatest(2, 3)).thenReturn(list);

        var result = service.latest(2, 3);

        assertEquals(list, result);
    }

    @Test
    void get_found_returnsEntity() {
        var e = new DoorbellEvent(5L, 5000L, true, 10);
        when(repo.findById(5L)).thenReturn(Optional.of(e));

        var result = service.get(5L);

        assertEquals(e, result);
    }

    @Test
    void get_notFound_returnsNull() {
        when(repo.findById(404L)).thenReturn(Optional.empty());

        var result = service.get(404L);

        assertNull(result);
    }
}
