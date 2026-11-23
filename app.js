// OpenAudio: jembatan UI ke endpoint /generate di Hugging Face Space.

const SPACE_ID = "KadekBoy/suara-audio";
const KUNCI_TOKEN_SESSION = "openaudio_hf_token";
const HF_WHOAMI_URL = "https://huggingface.co/api/whoami-v2";
const GRADIO_CLIENT_URL = "https://esm.sh/@gradio/client";

const PRESET_KUALITAS = {
  default: { cfg: 2.3, steps: 12 },
  tinggi: { cfg: 2.7, steps: 16 },
  cepat: { cfg: 2.0, steps: 8 },
};

const $ = (id) => document.getElementById(id);

const teks = $("teks");
const hitung = $("hitung");
const mode = $("mode");
const deskripsi = $("deskripsi");
const grupDeskripsi = $("grup_deskripsi");

const panelClone = $("panel_clone");
const rekamanAcuan = $("rekaman_acuan");
const transkripAcuan = $("transkrip_acuan");
const izinClone = $("izin_clone");

const presetGroup = $("preset_group");
const cfgInput = $("cfg");
const cfgVal = $("cfg_val");
const stepsInput = $("steps");
const stepsVal = $("steps_val");
const normalizeInput = $("normalize");

const hfTokenTop = $("hf_token");
const btnCekTokenTop = $("btn_cek_token_top");
const btnPanduanToken = $("btn_panduan_token");

const modalToken = $("modal_token");
const tutupModalToken = $("tutup_modal_token");
const batalModalToken = $("batal_modal_token");
const modalHfToken = $("modal_hf_token");
const simpanTokenBtn = $("simpan_token_btn");
const modalTokenAlasan = $("modal_token_alasan");

const tombol = $("tombol");
const status = $("status");
const hasilPlaceholder = $("hasil_placeholder");
const loadingBox = $("loading_box");
const loadingJudul = $("loading_judul");
const loadingSub = $("loading_sub");
const pemutar = $("pemutar");

const maxChars = Number(teks?.maxLength) || 500;

let client = null;
let tokenTerpasang = "";
let sedangCekToken = false;

// ---------- Token & Modal ----------
function bacaTokenSession() {
  try {
    return (sessionStorage.getItem(KUNCI_TOKEN_SESSION) || "").trim();
  } catch {
    return "";
  }
}

function simpanTokenKeStorage(nilai) {
  const bersih = (nilai || "").trim();
  try {
    if (bersih) sessionStorage.setItem(KUNCI_TOKEN_SESSION, bersih);
    else sessionStorage.removeItem(KUNCI_TOKEN_SESSION);
  } catch {}

  if (hfTokenTop && hfTokenTop.value !== bersih) hfTokenTop.value = bersih;
  if (modalHfToken && modalHfToken.value !== bersih) modalHfToken.value = bersih;

  if (bersih !== tokenTerpasang) {
    client = null;
    tokenTerpasang = "";
  }
}

function ambilTokenAktif() {
  return (hfTokenTop?.value || "").trim() || bacaTokenSession();
}

function adalahErrorKuota(pesan) {
  return /quota|ZeroGPU|runs limit/i.test(pesan || "");
}

function adalahErrorAuthToken(pesan) {
  return /invalid.*token|bad token|unauthorized|401|403|authentication|forbidden|tidak valid/i.test(
    pesan || ""
  );
}

function bukaModalToken(alasanTeks = "", isGalat = false) {
  if (!modalToken) return;
  if (alasanTeks && modalTokenAlasan) {
    modalTokenAlasan.textContent = alasanTeks;
    modalTokenAlasan.classList.toggle("galat", isGalat);
  }
  if (modalHfToken) modalHfToken.value = ambilTokenAktif();
  modalToken.hidden = false;
  modalHfToken?.focus();
}

function tutupModal() {
  if (modalToken) modalToken.hidden = true;
}

// ---------- UI & Status ----------
function tampilStatus(pesan, galat = false) {
  status.textContent = pesan;
  status.classList.toggle("galat", galat);
}

function aturLoading(aktif, judul = "Memproses audio...", sub = "Mohon tunggu sebentar") {
  if (!loadingBox) return;
  loadingBox.hidden = !aktif;
  if (aktif) {
    if (hasilPlaceholder) hasilPlaceholder.hidden = true;
    if (loadingJudul) loadingJudul.textContent = judul;
    if (loadingSub) loadingSub.textContent = sub;
  } else if (pemutar.hidden && hasilPlaceholder) {
    hasilPlaceholder.hidden = false;
  }
}

function bersihkanHasil() {
  pemutar.hidden = true;
  pemutar.removeAttribute("src");
  aturLoading(false);
}

function tampilHasil([audio]) {
  if (!audio?.url) throw new Error("Server tidak mengirim audio.");
  aturLoading(false);
  if (hasilPlaceholder) hasilPlaceholder.hidden = true;
  pemutar.src = audio.url;
  pemutar.hidden = false;
  tampilStatus("Selesai.");
}

function teksStatus(s) {
  if (s.stage === "pending") {
    return s.position != null ? `Menunggu giliran (urutan ${s.position + 1})...` : "Menunggu giliran...";
  }
  if (s.stage === "generating") return "Membuat suara...";
  return null;
}

function pesanGalat(pesan) {
  if (adalahErrorAuthToken(pesan)) {
    return "Token Hugging Face tidak valid atau sudah tidak aktif.";
  }
  if (adalahErrorKuota(pesan)) {
    return "Kuota GPU gratis habis. Masukkan token Hugging Face di pop-up untuk melanjutkan.";
  }
  return pesan || "Gagal membuat suara. Coba lagi.";
}

function perbaruiHitung() {
  if (hitung && teks) {
    hitung.textContent = `${teks.value.length} / ${maxChars} karakter`;
  }
}

function perbaruiMode() {
  const isClone = mode.value === "clone";
  const isPlain = mode.value === "plain";

  if (deskripsi) deskripsi.disabled = isPlain;
  if (grupDeskripsi) grupDeskripsi.hidden = isPlain;

  if (panelClone) panelClone.hidden = !isClone;
  if (rekamanAcuan) rekamanAcuan.disabled = !isClone;
  if (transkripAcuan) transkripAcuan.disabled = !isClone;
  if (izinClone) izinClone.disabled = !isClone;
}

function tandaiPresetAktif(namaPreset) {
  if (!presetGroup) return;
  presetGroup.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.preset === namaPreset);
  });
}

function terapkanPreset(namaPreset) {
  tandaiPresetAktif(namaPreset);
  const nilai = PRESET_KUALITAS[namaPreset];
  if (!nilai) return;

  if (cfgInput) cfgInput.value = String(nilai.cfg);
  if (stepsInput) stepsInput.value = String(nilai.steps);
  perbaruiSlider();
}

function perbaruiSlider() {
  if (cfgInput && cfgVal) cfgVal.textContent = Number(cfgInput.value).toFixed(1);
  if (stepsInput && stepsVal) stepsVal.textContent = String(Number(stepsInput.value));
}

// ---------- Koneksi Space & Verifikasi Token ----------
async function sambung(token = "") {
  const bersih = (token || "").trim();
  if (client && bersih === tokenTerpasang) return client;

  const { Client } = await import(GRADIO_CLIENT_URL);
  const opts = { events: ["data", "status"] };
  if (bersih) opts.hf_token = bersih;

  client = await Client.connect(SPACE_ID, opts);
  tokenTerpasang = bersih;
  return client;
}

async function cekDanPasangToken(token, { dariModal = false } = {}) {
  if (sedangCekToken) return;
  sedangCekToken = true;

  const bersih = (token || "").trim();

  try {
    if (!bersih) {
      simpanTokenKeStorage("");
      tampilStatus("Token dikosongkan. Menggunakan akses bawaan.");
      if (dariModal) tutupModal();
      return;
    }

    if (dariModal && simpanTokenBtn) simpanTokenBtn.disabled = true;
    if (btnCekTokenTop) btnCekTokenTop.disabled = true;

    tampilStatus("Memverifikasi token...");
    const res = await fetch(HF_WHOAMI_URL, {
      headers: { Authorization: `Bearer ${bersih}` },
    });
    if (!res.ok) throw new Error(`Token tidak valid (HTTP ${res.status}).`);

    await sambung(bersih);
    simpanTokenKeStorage(bersih);

    if (dariModal) tutupModal();
    tampilStatus("Token valid dan tersambung.");
  } catch (err) {
    client = null;
    tokenTerpasang = "";
    const msg = pesanGalat(err?.message);
    tampilStatus(msg, true);
    bukaModalToken(msg, true);
  } finally {
    sedangCekToken = false;
    if (dariModal && simpanTokenBtn) simpanTokenBtn.disabled = false;
    if (btnCekTokenTop) btnCekTokenTop.disabled = false;
  }
}

// ---------- Eksekusi /generate ----------
async function buatSuara() {
  const text = teks.value.trim();
  if (!text) return tampilStatus("Tulis teks dulu.", true);

  const modeAktif = mode.value;
  const fileAcuan = modeAktif === "clone" ? rekamanAcuan?.files?.[0] || null : null;
  const izinAktif = modeAktif === "clone" ? Boolean(izinClone?.checked) : false;

  if (modeAktif === "clone") {
    if (!fileAcuan) return tampilStatus("Pilih file rekaman suara acuan dulu.", true);
    if (!izinAktif) return tampilStatus("Centang pernyataan izin dulu.", true);
  }

  tombol.disabled = true;
  bersihkanHasil();
  aturLoading(true, "Menyambung ke server...", "Menyiapkan antrean pemrosesan suara");

  let adaHasil = false;
  let galat = null;

  try {
    const app = await sambung(ambilTokenAktif());

    const payload = [
      text,
      modeAktif,
      deskripsi ? deskripsi.value.trim() : "",
      fileAcuan,
      transkripAcuan ? transkripAcuan.value.trim() : "",
      izinAktif,
      cfgInput ? Number(cfgInput.value) : 2.3,
      stepsInput ? Number(stepsInput.value) : 12,
      normalizeInput ? Boolean(normalizeInput.checked) : true,
    ];

    for await (const msg of app.submit("/generate", payload)) {
      if (msg.type === "status") {
        if (msg.stage === "error") {
          galat = msg.message;
        } else {
          const t = teksStatus(msg);
          if (t) {
            tampilStatus(t);
            aturLoading(
              true,
              t,
              msg.stage === "pending"
                ? "Menunggu giliran GPU tersedia"
                : "Sedang mensintesis gelombang suara"
            );
          }
        }
      } else if (msg.type === "data") {
        tampilHasil(msg.data);
        adaHasil = true;
      }
    }

    if (!adaHasil) {
      aturLoading(false);
      const pesanAkhir = pesanGalat(galat);
      tampilStatus(pesanAkhir, true);
      if (adalahErrorKuota(galat) || adalahErrorAuthToken(galat)) {
        bukaModalToken(pesanAkhir, true);
      }
    }
  } catch (err) {
    aturLoading(false);
    const pesanAkhir = pesanGalat(galat || err?.message);
    tampilStatus(pesanAkhir, true);
    if (adalahErrorKuota(galat || err?.message) || adalahErrorAuthToken(galat || err?.message)) {
      bukaModalToken(pesanAkhir, true);
    }
  } finally {
    tombol.disabled = false;
  }
}

// ---------- Event Listeners ----------
teks?.addEventListener("input", perbaruiHitung);
mode?.addEventListener("change", perbaruiMode);

presetGroup?.addEventListener("click", (e) => {
  const btn = e.target.closest(".preset-btn");
  if (!btn?.dataset.preset) return;
  terapkanPreset(btn.dataset.preset);
});

cfgInput?.addEventListener("input", () => {
  perbaruiSlider();
  tandaiPresetAktif("custom");
});

stepsInput?.addEventListener("input", () => {
  perbaruiSlider();
  tandaiPresetAktif("custom");
});

tombol?.addEventListener("click", buatSuara);

btnCekTokenTop?.addEventListener("click", () => {
  cekDanPasangToken(hfTokenTop?.value || "", { dariModal: false });
});

hfTokenTop?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    cekDanPasangToken(hfTokenTop.value, { dariModal: false });
  }
});

btnPanduanToken?.addEventListener("click", () => {
  bukaModalToken(
    "Token Hugging Face bersifat opsional. Gunakan saat kuota gratis habis atau ingin memakai kuota akun sendiri.",
    false
  );
});

tutupModalToken?.addEventListener("click", tutupModal);
batalModalToken?.addEventListener("click", tutupModal);
modalToken?.addEventListener("click", (e) => {
  if (e.target === modalToken) tutupModal();
});

simpanTokenBtn?.addEventListener("click", () => {
  cekDanPasangToken(modalHfToken?.value || "", { dariModal: true });
});

modalHfToken?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    cekDanPasangToken(modalHfToken.value, { dariModal: true });
  }
});

// ---------- Inisialisasi ----------
const awalToken = bacaTokenSession();
if (awalToken && hfTokenTop) hfTokenTop.value = awalToken;
perbaruiHitung();
perbaruiMode();
terapkanPreset("default");