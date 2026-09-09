// Free-time computation for today. Pulls today's schedule from window.getTodayScheduleItems()
// and merges any caller-provided extra busy blocks.

const END_OF_DAY_MIN = 24 * 60;

function timeToMinutes(t) {
  // "HH:MM" or "HH:MM:SS" -> minutes since midnight
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

function bucketMinutes(m) {
  if (m < 20) return 'tiny';
  if (m < 60) return 'short';
  if (m < 120) return 'medium';
  return 'long';
}

function makeFreeBlock(startMin, endMin) {
  return {
    start: minutesToTime(startMin),
    end:   minutesToTime(endMin),
    minutes: endMin - startMin,
    bucket:  bucketMinutes(endMin - startMin),
  };
}

async function getFreeTimeToday(extraBusyBlocks = []) {
  const todayItems = await window.getTodayScheduleItems();

  // Normalize everything to { start, end } in minutes.
  const busy = [
    ...todayItems.map(item => ({
      start: timeToMinutes(item.start_time),
      end:   timeToMinutes(item.end_time),
    })),
    ...extraBusyBlocks.map(b => ({
      start: timeToMinutes(b.start),
      end:   timeToMinutes(b.end),
    })),
  ].sort((a, b) => a.start - b.start);

  // Merge overlapping and adjacent blocks.
  const merged = [];
  for (const block of busy) {
    if (block.end <= block.start) continue; // ignore zero/negative ranges
    if (merged.length === 0 || block.start > merged[merged.length - 1].end) {
      merged.push({ start: block.start, end: block.end });
    } else {
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, block.end);
    }
  }

  // Walk the gaps from now through end of day.
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const free = [];
  let cursor = nowMin;

  for (const block of merged) {
    if (block.end <= cursor) continue; // block entirely in the past
    const effectiveStart = Math.max(block.start, cursor);
    if (effectiveStart > cursor) {
      free.push(makeFreeBlock(cursor, effectiveStart));
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < END_OF_DAY_MIN) {
    free.push(makeFreeBlock(cursor, END_OF_DAY_MIN));
  }

  return free;
}

window.getFreeTimeToday = getFreeTimeToday;
