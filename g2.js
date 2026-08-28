function gauge(value, min, max) {
    const clamp = (n) => Math.max(0.03, Math.min(0.97, n));
    const hasMin = typeof min === 'number';
    const hasMax = typeof max === 'number';

    if (hasMin && hasMax && max > min) {
        const w = max - min;
        const [s, e] = [0.18, 0.82];
        // Below the floor, the band's own width is the wrong yardstick: ferritin's range is
        // 30–400, so a catastrophic 5 is only 7% of a band-width under the minimum and would
        // draw a hair to the left of "fine". Below, the distance that can exist is bounded by
        // the floor itself, so the smaller of the two is what the excursion is measured in.
        const below = min > 0 ? Math.min(w, min) : w;
        if (value < min) return { start: s, end: e, at: clamp(s * (1 - Math.min(1, (min - value) / below))) };
        if (value > max) return { start: s, end: e, at: clamp(e + (1 - e) * Math.min(1, (value - max) / w)) };
        return { start: s, end: e, at: clamp(s + (e - s) * ((value - min) / w)) };
    }
    // One-sided analytes: an upper limit with an implied floor of zero, or the reverse.
    if (hasMax && max > 0) {
        const [s, e] = [0.06, 0.72];
        if (value > max) return { start: s, end: e, at: clamp(e + (1 - e) * Math.min(1, (value - max) / max)) };
        return { start: s, end: e, at: clamp(s + (e - s) * (value / max)) };
    }
    if (hasMin && min > 0) {
        const [s, e] = [0.28, 0.94];
        // Headroom runs to three times the floor before it saturates. At one times, every
        // comfortably-sufficient value collapsed onto the same pixel.
        if (value < min) return { start: s, end: e, at: clamp(s * (1 - Math.min(1, (min - value) / min))) };
        return { start: s, end: e, at: clamp(s + (e - s) * Math.min(1, (value - min) / (min * 2))) };
    }
    return null;
}

/** Explicit return type: `left`/`right` want RN's `${number}%`, not a bare string. */

const t=(l,...a)=>{const g=gauge(...a);console.log(l.padEnd(24), g?g.at.toFixed(3):'null');};
console.log('-- ferritin 30-400 (band .18-.82)');
[5,15,28,30,215,400,410,900].forEach(v=>t('  '+v,v,30,400));
console.log('-- HbA1c 4.0-5.6');
[3.0,3.9,4.0,4.8,5.6,6.5,9.0].forEach(v=>t('  '+v,v,4.0,5.6));
console.log('-- LDL <3.0 upper-only (band .06-.72)');
[0,1.5,3,4,9].forEach(v=>t('  '+v,v,undefined,3));
console.log('-- vitD >50 lower-only (band .28-.94)');
[10,49,50,75,100,150,200].forEach(v=>t('  '+v,v,50,undefined));
console.log('-- no range'); t('  5',5,undefined,undefined);
