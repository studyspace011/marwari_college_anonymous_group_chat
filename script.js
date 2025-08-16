// === कॉन्फ़िग ===
// === CONFIG ===
// अपनी वेब ऐप URL यहां पेस्ट करें (उदाहरण: https://script.google.com/macros/s/AKfycb.../exec)
// Paste your Web App URL here (e.g., https://script.google.com/macros/s/AKfycb.../exec)
const API_URL = 'https://script.google.com/macros/s/AKfycbwmnYD-VUJpGOIFQoKqsAyAuezGbUVZGQVVd6tak-ulRfj1f3nN1LxofI0ajfjBy1PvNg/exec';
const POLL_MS = 3000; // हर 3 सेकंड में नए संदेशों के लिए पोल करें

// === स्थिति ===
// === STATE ===
const ls = window.localStorage;
// यदि मौजूद नहीं है तो एक अद्वितीय गुमनाम ID उत्पन्न करें
const anonId = ls.getItem('anonId') || (() => {
    const id = Math.random().toString(36).slice(2, 10);
    ls.setItem('anonId', id);
    return id;
})();
const savedName = ls.getItem('name') || '';
const savedColor = ls.getItem('color') || randomColor();

// DOM तत्वों को प्राप्त करें
const el = {
    list: document.getElementById('list'),
    name: document.getElementById('name'),
    color: document.getElementById('color'),
    msg: document.getElementById('message'),
    send: document.getElementById('sendBtn'),
    emojiBtn: document.getElementById('emojiBtn'),
    tray: document.getElementById('tray'),
};

// सहेजे गए मानों के साथ इनपुट फ़ील्ड सेट करें
el.name.value = savedName;
el.color.value = savedColor;

// === इमोजी ट्रे ===
// === Emoji tray ===
const EMOJIS = "😀😁😂🤣🙂😉😊😍😘😎🤗🤩🤔🤨😐😴😪😷🤒🤕🤧🥳🤠🤫🤭🤤😏🙃😇🥲😭😤😡😱😳😬😵‍💫😮‍💨💀🤝👏👍👎🙏💪🔥✨🌟🎉🎈🥰💔❤️‍🔥❤️‍🩹❤️💙💚💛💜🤍🫶👌🤌🤟👋🙌🫡🫠🫣🫢🫡".split('');
function buildTray() {
    el.tray.innerHTML = '';
    EMOJIS.forEach(e => {
        const b = document.createElement('button');
        b.textContent = e;
        b.addEventListener('click', () => {
            el.msg.value += e; // इमोजी को संदेश इनपुट में जोड़ें
            toggleTray(false); // इमोजी ट्रे को बंद करें
            el.msg.focus(); // संदेश इनपुट पर फ़ोकस वापस करें
        });
        el.tray.appendChild(b);
    });
}
buildTray(); // स्टार्टअप पर इमोजी ट्रे बनाएं

function toggleTray(force) {
    // ट्रे की दृश्यता को टॉगल करें
    const on = force !== undefined ? force : el.tray.style.display !== 'grid';
    el.tray.style.display = on ? 'grid' : 'none';
    el.tray.setAttribute('aria-hidden', on ? 'false' : 'true');
}
el.emojiBtn.addEventListener('click', () => toggleTray()); // इमोजी बटन पर क्लिक करने पर ट्रे को टॉगल करें

// === अपशब्द फ़िल्टर (बुनियादी) ===
// === Profanity filter (basic) ===
const BAD_WORDS = ['*****','*****','*****','*****','*****','*****','*****','chutiya','madarchod','behenchod','randi','harami','gaand','saala','nalayak'];
function cleanProfanity(text) {
    // अपशब्दों को तारों से बदलें (पहला अक्षर छोड़कर)
    const pattern = new RegExp('\\b(' + BAD_WORDS.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|') + ')\\b', 'gi');
    return text.replace(pattern, (m) => m[0] + '*'.repeat(Math.max(0, m.length - 1)));
}

// === सहायक कार्य ===
// === Helpers ===
function randomColor() {
    // एक यादृच्छिक HSL रंग उत्पन्न करें
    const h = Math.floor(Math.random()*360);
    return `hsl(${h} 70% 60%)`;
}
function isoToTime(iso) {
    // ISO स्ट्रिंग को HH:MM समय प्रारूप में बदलें
    try {
        const d = new Date(iso);
        const hh = d.getHours().toString().padStart(2,'0');
        const mm = d.getMinutes().toString().padStart(2,'0');
        return `${hh}:${mm}`;
    } catch { return ''; }
}
function renderText(txt) {
    // @उल्लेखों को हाइलाइट करें
    return txt.replace(/(^|\s)@([a-zA-Z0-9_-]{2,20})/g, (m, sp, who) => `${sp}<span class="mention">@${who}</span>`);
}

// HTML विशेष वर्णों से बचें
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// === संदेश प्राप्त करें और रेंडर करें ===
// === Fetch & render ===
let cacheIds = new Set(); // डुप्लिकेट संदेशों से बचने के लिए ID कैश करें
async function fetchMessages() {
    try {
        const res = await fetch(API_URL, { method: 'GET' });
        const data = await res.json();
        if (!data.ok) return;
        drawList(data.messages || []); // संदेशों को UI में ड्रा करें
    } catch (e) {
        // वैकल्पिक: एक छोटा कनेक्टिविटी संकेत दिखाएं
        console.error("संदेश प्राप्त करने में त्रुटि:", e);
    }
}

function drawList(messages) {
    // बुनियादी डुप्लीकेशन हटाना
    const frag = document.createDocumentFragment();
    messages.forEach(m => {
        if (cacheIds.has(m.id)) return; // यदि संदेश पहले से कैश में है, तो छोड़ दें
        cacheIds.add(m.id); // कैश में नई संदेश ID जोड़ें

        const me = m.anonId === anonId; // यह संदेश मेरे द्वारा भेजा गया है या नहीं
        const row = document.createElement('div');
        row.className = 'msg' + (me ? ' me' : ''); // यदि यह मेरा संदेश है तो 'me' क्लास जोड़ें

        const av = document.createElement('div');
        av.className = 'avatar';
        av.style.color = '#000';
        av.style.background = m.color || '#aaa';
        av.textContent = (m.name || 'A')[0]?.toUpperCase() || 'A'; // नाम का पहला अक्षर अवतार के रूप में

        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        const meta = document.createElement('div');
        meta.className = 'meta';

        const nm = document.createElement('span');
        nm.className = 'name';
        nm.textContent = m.name || 'Anon'; // यदि नाम खाली है तो 'Anon' दिखाएं
        nm.style.color = m.color || '#7aa2f7';

        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = isoToTime(m.ts);

        meta.appendChild(nm);
        meta.appendChild(time);

        const text = document.createElement('div');
        text.className = 'text';
        text.innerHTML = renderText(escapeHtml(m.message)); // संदेश टेक्स्ट को रेंडर करें और @उल्लेखों को हाइलाइट करें

        bubble.appendChild(meta);
        bubble.appendChild(text);

        row.appendChild(av);
        row.appendChild(bubble);
        frag.appendChild(row);
    });

    // केवल पहले लोड पर साफ़ करें और फिर से ड्रा करें; बाद में वृद्धिशील रूप से जोड़ें
    if (el.list.children.length === 0) {
        el.list.innerHTML = '';
        // खरोंच से फिर से बनाएं
        messages.forEach(m => cacheIds.add(m.id)); // सुनिश्चित करें कि कैश भरा हुआ है
        el.list.appendChild(frag);
    } else {
        el.list.appendChild(frag);
    }
    // नीचे ऑटो-स्क्रॉल करें
    el.list.parentElement.scrollTop = el.list.parentElement.scrollHeight;
}


// === संदेश भेजें ===
// === Send ===
async function send() {
    let name = el.name.value.trim();
    if (!name) {
        // डिवाइस के अनुसार गुमनाम नाम
        if (!ls.getItem('anonName')) {
            ls.setItem('anonName', 'Anon-' + Math.random().toString(36).slice(2,6));
        }
        name = ls.getItem('anonName');
    }
    const color = el.color.value || randomColor();
    const raw = el.msg.value.trim();
    if (!raw) return; // यदि संदेश खाली है तो कुछ न करें

    // वरीयताओं को सहेजें
    ls.setItem('name', el.name.value.trim());
    ls.setItem('color', color);

    // क्लाइंट पर अपशब्दों को साफ़ करें
    const message = cleanProfanity(raw);

    // POST अनुरोध भेजें
    try {
        el.send.disabled = true; // भेजने के दौरान बटन को अक्षम करें
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, message, color, anonId })
        });
        const data = await res.json();
        // स्नैपी अनुभव के लिए आशावादी रूप से जोड़ें
        if (data.ok) {
            const now = new Date().toISOString();
            // अस्थायी ID या वास्तविक ID के साथ संदेश प्रदर्शित करें
            drawList([{ id: data.id || Math.random().toString(36), ts: now, anonId, name, color, message }]);
            el.msg.value = ''; // संदेश इनपुट को साफ़ करें
        }
    } catch (e) {
        console.error("संदेश भेजने में त्रुटि:", e);
        // चुपचाप अनदेखा करें
    } finally {
        el.send.disabled = false; // बटन को फिर से सक्षम करें
        el.msg.focus(); // संदेश इनपुट पर फ़ोकस वापस करें
    }
}

// === घटना श्रोता ===
// === Event Listeners ===
el.send.addEventListener('click', send); // भेजें बटन पर क्लिक करने पर संदेश भेजें
el.msg.addEventListener('keydown', (e) => {
    // एंटर दबाने पर (शिफ्ट के बिना) संदेश भेजें
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // डिफ़ॉल्ट व्यवहार (नई पंक्ति) रोकें
        send();
    }
});
el.name.addEventListener('change', () => ls.setItem('name', el.name.value.trim())); // नाम बदलने पर सहेजें
el.color.addEventListener('change', () => ls.setItem('color', el.color.value)); // रंग बदलने पर सहेजें

// === पोलिंग शुरू करें ===
// === Start Polling ===
fetchMessages(); // प्रारंभिक संदेश लोड
setInterval(fetchMessages, POLL_MS); // हर 3 सेकंड में संदेशों के लिए पोल करें

