/**
 * script.js — Customer Feedback Sentiment Analyzer
 *
 * Struktur modul:
 *  1. LEKSIKON SENTIMEN   — daftar kata kunci positif, negatif, penguat, negasi
 *  2. ENGINE SENTIMEN     — fungsi analisis teks berbasis skor kata kunci
 *  3. DATA DUMMY AWAL     — 5+ feedback pra-isi yang dimuat saat halaman dibuka
 *  4. STATE APLIKASI      — array riwayat dan instance Chart.js
 *  5. RENDER UI           — fungsi update kartu hasil, riwayat, statistik, chart
 *  6. EVENT HANDLERS      — tombol analisis, penghitung karakter
 *  7. INISIALISASI        — bootstrap chart dan muat data dummy
 */

/* ============================================================
   SECTION 1 · LEKSIKON SENTIMEN
   ============================================================
   Basis deteksi: setiap kata diberi bobot +1 (positif) atau -1 (negatif).
   Kata penguat (amplifier) menggandakan bobot kata berikutnya.
   Kata negasi (negator) membalik bobot kata berikutnya.
   ============================================================ */

const LEXICON = {
  /**
   * Kata-kata POSITIF beserta bobotnya.
   * Bobot lebih tinggi = sinyal lebih kuat.
   */
  positive: {
    // Kepuasan & kualitas
    'bagus': 2, 'baik': 1, 'luar biasa': 3, 'mantap': 2, 'keren': 2,
    'hebat': 2, 'memuaskan': 2, 'puas': 2, 'senang': 2, 'suka': 1,
    'cinta': 2, 'seru': 1, 'menarik': 1, 'nyaman': 2, 'mudah': 1,
    'cepat': 2, 'tepat waktu': 2, 'responsif': 2, 'ramah': 2, 'sopan': 2,
    'profesional': 2, 'amanah': 2, 'terpercaya': 2, 'aman': 1,
    'berkualitas': 2, 'terbaik': 3, 'sempurna': 3, 'wow': 2,
    'rekomendasi': 2, 'merekomendasikan': 2, 'recommend': 2,
    'awesome': 2, 'excellent': 3, 'good': 1, 'great': 2, 'love': 2,
    'happy': 2, 'satisfied': 2, 'fast': 1, 'quick': 1, 'nice': 1,
    'helpful': 2, 'friendly': 2, 'amazing': 3, 'perfect': 3,
    'terima kasih': 1, 'makasih': 1, 'thanks': 1, 'thank you': 2,
    'indah': 1, 'cantik': 1, 'kualitas bagus': 3, 'worth it': 2,
    'sesuai': 1, 'sesuai ekspektasi': 2, 'melebihi ekspektasi': 3,
    'oke': 1, 'ok': 1, 'super': 2, 'top': 2, 'bintang': 1,
  },

  /**
   * Kata-kata NEGATIF beserta bobotnya (nilai absolut).
   * Akan dikurangi dari skor total.
   */
  negative: {
    // Ketidakpuasan & masalah
    'buruk': 2, 'jelek': 2, 'parah': 3, 'kecewa': 3, 'mengecewakan': 3,
    'tidak puas': 3, 'tidak bagus': 2, 'tidak baik': 2, 'rusak': 3,
    'hancur': 3, 'lambat': 2, 'telat': 2, 'terlambat': 2, 'lama': 1,
    'susah': 1, 'sulit': 1, 'ribet': 2, 'mahal': 1, 'ketipu': 3,
    'tipu': 3, 'bohong': 3, 'tidak sesuai': 2, 'salah': 1, 'keliru': 1,
    'cacat': 3, 'retak': 2, 'bocor': 2, 'kotor': 2, 'bau': 2,
    'tidak responsif': 2, 'tidak ramah': 2, 'kasar': 2, 'tidak profesional': 2,
    'menipu': 3, 'penipuan': 3, 'scam': 3, 'fraud': 3,
    'bad': 2, 'terrible': 3, 'awful': 3, 'poor': 2, 'disappointed': 3,
    'disappointing': 3, 'slow': 1, 'rude': 2, 'broken': 3, 'fake': 3,
    'worst': 3, 'horrible': 3, 'hate': 3, 'angry': 2, 'upset': 2,
    'tidak memuaskan': 2, 'menganggu': 1, 'mengganggu': 1,
    'komplain': 2, 'masalah': 1, 'problem': 1, 'error': 1, 'bug': 1,
  },

  /**
   * Kata PENGUAT — melipatgandakan bobot kata kunci berikutnya.
   * Faktor 1.5 artinya 50% lebih kuat.
   */
  amplifiers: {
    'sangat': 1.5, 'sekali': 1.5, 'banget': 1.5, 'benar-benar': 1.5,
    'sungguh': 1.5, 'amat': 1.5, 'super': 1.5, 'betul-betul': 1.5,
    'really': 1.5, 'very': 1.5, 'so': 1.3, 'truly': 1.5, 'extremely': 2.0,
    'totally': 1.5, 'absolutely': 1.5, 'paling': 1.5, 'terlalu': 1.3,
  },

  /**
   * Kata NEGASI — membalik polaritas kata kunci berikutnya.
   * Contoh: "tidak bagus" → negatif walau "bagus" positif.
   */
  negators: [
    'tidak', 'bukan', 'tak', 'ga', 'gak', 'ngga', 'nggak',
    'kurang', 'belum', "doesn't", "don't", "not", "never", 'nope',
  ],
};

/* ============================================================
   SECTION 2 · ENGINE SENTIMEN
   ============================================================ */

/**
 * Tokenisasi teks menjadi array kata / frasa.
 * Menormalisasi ke huruf kecil dan menghapus tanda baca.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')   // hapus tanda baca
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Memeriksa apakah token pada posisi `i` dalam array tokens
 * didahului oleh kata negasi dalam jarak maksimal 2 posisi.
 * @param {string[]} tokens
 * @param {number} i - posisi token saat ini
 * @returns {boolean}
 */
function isNegated(tokens, i) {
  const windowStart = Math.max(0, i - 2);
  for (let j = windowStart; j < i; j++) {
    if (LEXICON.negators.includes(tokens[j])) return true;
  }
  return false;
}

/**
 * Mendapatkan faktor penguat yang berlaku pada posisi `i`.
 * Mengecek satu posisi sebelumnya.
 * @param {string[]} tokens
 * @param {number} i
 * @returns {number} faktor multiplier (1.0 = tidak ada penguat)
 */
function getAmplifier(tokens, i) {
  if (i > 0 && LEXICON.amplifiers[tokens[i - 1]]) {
    return LEXICON.amplifiers[tokens[i - 1]];
  }
  return 1.0;
}

/**
 * FUNGSI UTAMA SIMULASI SENTIMEN
 *
 * Algoritma:
 *  1. Tokenisasi teks input
 *  2. Juga cek frasa dua kata (bigram) agar "tidak bagus" terdeteksi
 *  3. Untuk setiap token/bigram yang cocok di leksikon:
 *     a. Ambil bobot dasar dari leksikon positif/negatif
 *     b. Kalikan dengan faktor penguat (jika ada)
 *     c. Balik polaritas jika ada negasi sebelumnya
 *  4. Hitung total skor bersih dan klasifikasikan:
 *     score > THRESHOLD_POS  → Positif
 *     score < THRESHOLD_NEG  → Negatif
 *     di antara keduanya     → Netral
 *
 * @param {string} text - teks ulasan mentah
 * @returns {{
 *   sentiment: 'Positif'|'Netral'|'Negatif',
 *   score: number,
 *   normalizedScore: number,  // 0–100, 50 = netral
 *   matchedKeywords: Array<{word: string, polarity: 'positive'|'negative'|'neutral', weight: number}>
 * }}
 */
function analyzeSentiment(text) {
  // Threshold klasifikasi (dapat disesuaikan)
  const THRESHOLD_POS =  1.5;
  const THRESHOLD_NEG = -1.5;

  const tokens = tokenize(text);
  let score = 0;
  const matchedKeywords = [];
  const matchedSet = new Set(); // hindari duplikat

  // ── Pass 1: cek bigram (frasa 2 kata) ──
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;

    if (LEXICON.positive[bigram] !== undefined) {
      const w = LEXICON.positive[bigram] * getAmplifier(tokens, i);
      const polarity = isNegated(tokens, i) ? 'negative' : 'positive';
      score += polarity === 'positive' ? w : -w;
      if (!matchedSet.has(bigram)) {
        matchedSet.add(bigram);
        matchedKeywords.push({ word: bigram, polarity, weight: w });
      }
    }

    if (LEXICON.negative[bigram] !== undefined) {
      const w = LEXICON.negative[bigram] * getAmplifier(tokens, i);
      const polarity = isNegated(tokens, i) ? 'positive' : 'negative';
      score += polarity === 'negative' ? -w : w;
      if (!matchedSet.has(bigram)) {
        matchedSet.add(bigram);
        matchedKeywords.push({ word: bigram, polarity, weight: w });
      }
    }
  }

  // ── Pass 2: cek unigram (kata tunggal) ──
  tokens.forEach((token, i) => {
    if (matchedSet.has(token)) return; // bigram sudah cocok, lewati

    if (LEXICON.positive[token] !== undefined) {
      const amp     = getAmplifier(tokens, i);
      const w       = LEXICON.positive[token] * amp;
      const negated = isNegated(tokens, i);
      const polarity = negated ? 'negative' : 'positive';
      score += negated ? -w : w;
      if (!matchedSet.has(token)) {
        matchedSet.add(token);
        matchedKeywords.push({ word: token, polarity, weight: w });
      }
    }

    if (LEXICON.negative[token] !== undefined) {
      const amp     = getAmplifier(tokens, i);
      const w       = LEXICON.negative[token] * amp;
      const negated = isNegated(tokens, i);
      const polarity = negated ? 'positive' : 'negative';
      score += negated ? w : -w;
      if (!matchedSet.has(token)) {
        matchedSet.add(token);
        matchedKeywords.push({ word: token, polarity, weight: w });
      }
    }
  });

  // ── Klasifikasi ──
  let sentiment;
  if      (score >= THRESHOLD_POS) sentiment = 'Positif';
  else if (score <= THRESHOLD_NEG) sentiment = 'Negatif';
  else                              sentiment = 'Netral';

  // Normalisasi skor ke rentang 0–100 (50 = netral)
  // Clamp pada ±10 sebelum mapping
  const clampedScore = Math.max(-10, Math.min(10, score));
  const normalizedScore = Math.round(((clampedScore + 10) / 20) * 100);

  return { sentiment, score: parseFloat(score.toFixed(2)), normalizedScore, matchedKeywords };
}

/* ============================================================
   SECTION 3 · DATA DUMMY AWAL
   ============================================================
   Minimal 5 feedback pra-isi untuk mendemonstrasikan dashboard
   sejak halaman pertama kali dibuka.
   ============================================================ */

/**
 * Format timestamp readable
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return date.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Seed data awal — diproses melalui engine sentimen yang sama */
const DUMMY_FEEDBACKS = [
  { text: "Produk ini sangat bagus dan berkualitas! Pengirimannya cepat, saya sangat puas dengan pelayanannya. Pasti akan beli lagi!", date: new Date('2024-06-10T09:15:00') },
  { text: "Kecewa banget sama produk ini. Barangnya rusak waktu sampai, dan customer service tidak responsif sama sekali. Tidak memuaskan!", date: new Date('2024-06-11T14:22:00') },
  { text: "Produk oke sih, sesuai dengan deskripsi. Pengiriman normal, tidak terlalu cepat tapi tidak terlambat juga. Cukup memuaskan.", date: new Date('2024-06-12T10:05:00') },
  { text: "Luar biasa! Kualitas melebihi ekspektasi saya. Seller sangat ramah dan profesional. Highly recommend untuk semua orang!", date: new Date('2024-06-13T16:45:00') },
  { text: "Parah banget ini toko! Barang tidak sesuai foto, sudah komplain tapi tidak ada respon. Penipuan! Tidak akan beli lagi disini.", date: new Date('2024-06-14T08:30:00') },
  { text: "Pelayanan cukup baik, staf ramah dan helpful. Produknya lumayan, tapi harganya agak mahal dibanding kompetitor.", date: new Date('2024-06-15T11:20:00') },
  { text: "Wow, amazing service! Fast delivery and the product is exactly as described. Happy with my purchase, will definitely recommend!", date: new Date('2024-06-16T13:55:00') },
];

/* ============================================================
   SECTION 4 · STATE APLIKASI
   ============================================================ */

/** Array riwayat analisis — setiap item: { text, result, date } */
let analysisHistory = [];

/** Instance Chart.js — disimpan agar dapat diperbarui tanpa re-create */
let sentimentChart = null;

/* ============================================================
   SECTION 5 · RENDER UI
   ============================================================ */

/**
 * Menampilkan kartu hasil analisis dengan warna dan informasi
 * sesuai sentimen yang terdeteksi.
 * @param {string} text - teks asli
 * @param {object} result - output analyzeSentiment()
 */
function renderResultCard(text, result) {
  const section = document.getElementById('resultSection');
  const card    = document.getElementById('resultCard');

  // Peta konfigurasi visual per sentimen
  const config = {
    'Positif': { emoji: '😊', themeClass: 'result-positive', label: 'Positif', badge: 'POSITIF', barClass: 'score-bar-fill' },
    'Netral':  { emoji: '😐', themeClass: 'result-neutral',  label: 'Netral',  badge: 'NETRAL',  barClass: 'score-bar-fill' },
    'Negatif': { emoji: '😞', themeClass: 'result-negative', label: 'Negatif', badge: 'NEGATIF', barClass: 'score-bar-fill' },
  };

  const cfg = config[result.sentiment];

  // Terapkan tema warna
  card.className = `result-card rounded-2xl border-2 p-5 transition-all duration-300 ${cfg.themeClass}`;

  // Icon badge background
  document.getElementById('resultIconWrap').className =
    `w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl result-icon-bg`;
  document.getElementById('resultEmoji').textContent = cfg.emoji;

  // Label + badge
  document.getElementById('resultLabel').textContent = cfg.label;
  document.getElementById('resultLabel').className   = `text-lg font-bold result-label`;
  document.getElementById('resultBadge').textContent = cfg.badge;
  document.getElementById('resultBadge').className   = `sentiment-badge text-xs font-semibold px-2.5 py-0.5 rounded-full`;

  // Skor numerik
  document.getElementById('resultScore').textContent = `Skor: ${result.score > 0 ? '+' : ''}${result.score}`;

  // Preview teks (potong jika panjang)
  const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
  document.getElementById('resultPreview').textContent = preview;

  // Keyword chips
  const keywordsEl = document.getElementById('resultKeywords');
  keywordsEl.innerHTML = '';
  if (result.matchedKeywords.length === 0) {
    const chip = document.createElement('span');
    chip.className = 'keyword-chip keyword-neutral';
    chip.textContent = 'tidak ada kata kunci terdeteksi';
    keywordsEl.appendChild(chip);
  } else {
    result.matchedKeywords.slice(0, 8).forEach(kw => {
      const chip = document.createElement('span');
      chip.className = `keyword-chip keyword-${kw.polarity}`;
      chip.textContent = `${kw.polarity === 'positive' ? '↑' : kw.polarity === 'negative' ? '↓' : '·'} ${kw.word}`;
      chip.title = `Bobot: ${kw.weight.toFixed(1)}`;
      keywordsEl.appendChild(chip);
    });
  }

  // Skor bar (normalizedScore 0–100)
  const bar = document.getElementById('scoreBar');
  bar.style.width = `${result.normalizedScore}%`;
  // Warna bar sesuai tema
  bar.className = `absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${cfg.barClass}`;

  // Tampilkan section
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Menambahkan satu item ke daftar riwayat (paling atas).
 * @param {{ text: string, result: object, date: Date }} item
 */
function prependHistoryItem(item) {
  const list    = document.getElementById('historyList');
  const empty   = document.getElementById('historyEmpty');
  const counter = document.getElementById('historyCount');

  // Sembunyikan empty state
  empty.classList.add('hidden');

  const dotClass = {
    'Positif': 'dot-positive',
    'Netral':  'dot-neutral',
    'Negatif': 'dot-negative',
  }[item.result.sentiment];

  const preview = item.text.length > 90 ? item.text.slice(0, 90) + '…' : item.text;

  const div = document.createElement('div');
  div.className = 'history-item';
  div.setAttribute('role', 'listitem');
  div.innerHTML = `
    <span class="history-dot ${dotClass}" aria-hidden="true"></span>
    <p class="history-text">${escapeHtml(preview)}</p>
    <div class="history-meta">
      <span class="font-semibold ${item.result.sentiment === 'Positif' ? 'text-emerald-600' : item.result.sentiment === 'Negatif' ? 'text-red-500' : 'text-gray-500'}">${item.result.sentiment}</span><br/>
      ${formatTime(item.date)}
    </div>
  `;

  // Insert di atas (paling baru tampil pertama)
  list.insertBefore(div, list.firstChild);

  // Update counter
  counter.textContent = `${analysisHistory.length} entri`;
}

/**
 * Membangun ulang seluruh daftar riwayat dari array state.
 * Digunakan saat inisialisasi data dummy.
 */
function rebuildHistoryList() {
  const list  = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  list.innerHTML = '';

  if (analysisHistory.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  // Tampilkan dari yang terbaru (reverse)
  [...analysisHistory].reverse().forEach(item => {
    const dotClass = {
      'Positif': 'dot-positive',
      'Netral':  'dot-neutral',
      'Negatif': 'dot-negative',
    }[item.result.sentiment];

    const preview = item.text.length > 90 ? item.text.slice(0, 90) + '…' : item.text;

    const div = document.createElement('div');
    div.className = 'history-item';
    div.setAttribute('role', 'listitem');
    div.innerHTML = `
      <span class="history-dot ${dotClass}" aria-hidden="true"></span>
      <p class="history-text">${escapeHtml(preview)}</p>
      <div class="history-meta">
        <span class="font-semibold ${item.result.sentiment === 'Positif' ? 'text-emerald-600' : item.result.sentiment === 'Negatif' ? 'text-red-500' : 'text-gray-500'}">${item.result.sentiment}</span><br/>
        ${formatTime(item.date)}
      </div>
    `;
    list.appendChild(div);
  });

  document.getElementById('historyCount').textContent = `${analysisHistory.length} entri`;
}

/**
 * Memperbarui tiga kartu statistik (Positif / Netral / Negatif).
 */
function updateStats() {
  const counts = { Positif: 0, Netral: 0, Negatif: 0 };
  analysisHistory.forEach(item => counts[item.result.sentiment]++);

  document.getElementById('statPositive').textContent = counts.Positif;
  document.getElementById('statNeutral').textContent  = counts.Netral;
  document.getElementById('statNegative').textContent = counts.Negatif;
}

/**
 * INISIALISASI / UPDATE CHART.JS
 *
 * Membuat instance Chart.js Doughnut baru jika belum ada,
 * atau memperbarui data di instance yang sudah ada.
 * Pembaruan dilakukan tanpa re-create untuk animasi halus.
 */
function updateChart() {
  const counts = { Positif: 0, Netral: 0, Negatif: 0 };
  analysisHistory.forEach(item => counts[item.result.sentiment]++);

  const data   = [counts.Positif, counts.Netral, counts.Negatif];
  const total  = data.reduce((a, b) => a + b, 0);

  // ── Perbarui atau buat baru ──
  if (sentimentChart) {
    // Update data in-place agar animasi transisi berjalan
    sentimentChart.data.datasets[0].data = data;
    sentimentChart.update();
  } else {
    /**
     * Inisialisasi Chart.js Doughnut pertama kali.
     * Plugin 'centerText' khusus menampilkan total di tengah donat.
     */
    const centerTextPlugin = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `bold 22px -apple-system, Segoe UI, sans-serif`;
        ctx.fillStyle    = '#111827';
        ctx.fillText(total, cx, cy - 8);
        ctx.font      = `12px -apple-system, Segoe UI, sans-serif`;
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('Total', cx, cy + 12);
        ctx.restore();
      }
    };

    const ctx = document.getElementById('sentimentChart').getContext('2d');
    sentimentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Positif', 'Netral', 'Negatif'],
        datasets: [{
          data,
          backgroundColor: ['#22c55e', '#9ca3af', '#ef4444'],
          borderColor:      ['#ffffff', '#ffffff', '#ffffff'],
          borderWidth: 3,
          hoverOffset: 6,
          hoverBorderWidth: 0,
        }]
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        cutout:              '68%',
        plugins: {
          legend: { display: false },  // custom legend dibuat manual
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          duration: 600,
        }
      },
      plugins: [centerTextPlugin],
    });
  }

  // ── Render custom legend ──
  const legendEl = document.getElementById('chartLegend');
  const labels = ['Positif', 'Netral', 'Negatif'];
  const colors = ['#22c55e', '#9ca3af', '#ef4444'];
  legendEl.innerHTML = '';
  labels.forEach((label, i) => {
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : '0.0';
    const span = document.createElement('span');
    span.className = 'flex items-center gap-1.5';
    span.innerHTML = `
      <span style="width:10px;height:10px;border-radius:50%;background:${colors[i]};display:inline-block;" aria-hidden="true"></span>
      <span>${label}: <strong>${data[i]}</strong> (${pct}%)</span>
    `;
    legendEl.appendChild(span);
  });
}

/* ── Escape helper to prevent XSS in innerHTML ── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   SECTION 6 · EVENT HANDLERS
   ============================================================ */

/**
 * Handler tombol "Analisis Sentimen".
 * Membaca textarea, menjalankan engine, dan memperbarui UI.
 */
function handleAnalyze() {
  const input = document.getElementById('feedbackInput');
  const text  = input.value.trim();

  if (!text) {
    // Goyangkan textarea jika kosong
    input.classList.add('ring-2', 'ring-red-300');
    input.focus();
    setTimeout(() => input.classList.remove('ring-2', 'ring-red-300'), 1500);
    return;
  }

  // Jalankan analisis
  const result = analyzeSentiment(text);

  // Simpan ke riwayat
  const item = { text, result, date: new Date() };
  analysisHistory.push(item);

  // Perbarui UI
  renderResultCard(text, result);
  prependHistoryItem(item);
  updateStats();
  updateChart();

  // Reset textarea
  input.value = '';
  document.getElementById('charCount').textContent = '0 karakter';
}

/* ── Penghitung karakter live ── */
function handleInput() {
  const len = document.getElementById('feedbackInput').value.length;
  const el  = document.getElementById('charCount');
  el.textContent = `${len} karakter`;
  el.className = len > 500
    ? 'text-xs text-amber-500'
    : 'text-xs text-gray-400';
}

/* ── Kirim dengan Ctrl/Cmd+Enter ── */
function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleAnalyze();
  }
}

/* ============================================================
   SECTION 7 · INISIALISASI
   ============================================================ */

/**
 * Bootstrap aplikasi:
 *  1. Proses semua data dummy melalui engine sentimen
 *  2. Bangun riwayat dan statistik awal
 *  3. Inisialisasi Chart.js
 *  4. Pasang event listeners
 */
function init() {
  // Proses data dummy
  DUMMY_FEEDBACKS.forEach(fb => {
    const result = analyzeSentiment(fb.text);
    analysisHistory.push({ text: fb.text, result, date: fb.date });
  });

  // Render komponen awal
  rebuildHistoryList();
  updateStats();
  updateChart();

  // Event listeners
  document.getElementById('btnAnalyze').addEventListener('click', handleAnalyze);
  document.getElementById('feedbackInput').addEventListener('input', handleInput);
  document.getElementById('feedbackInput').addEventListener('keydown', handleKeydown);
}

// Mulai saat DOM siap
document.addEventListener('DOMContentLoaded', init);
