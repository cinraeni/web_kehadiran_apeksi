import { db } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const dateDisplay = document.getElementById('current-date');
    const form = document.getElementById('attendance-form');
    const submitBtn = document.getElementById('submit-btn');
    
    // Ambil data hari ini
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay(); // 0 = Minggu, 1 = Senin, dst
    
    // Format Tanggal
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = currentDate.toLocaleDateString('id-ID', options);
    }

    // Cek apakah hari ini Senin-Jumat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
        // Nonaktifkan form jika akhir pekan
        showAlert('Presensi hanya dibuka pada hari kerja (Senin - Jumat).', 'error');
        disableForm();
    }

    // --- BAGIAN TANDA TANGAN ---
    const canvas = document.getElementById('signature-pad');
    
    function resizeCanvas() {
        const ratio =  Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
    }
    
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Kita gunakan library SignaturePad global yang di-load dari index.html
    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(30, 58, 138)' // Biru tua
    });

    document.getElementById('btn-clear-signature').addEventListener('click', () => {
        signaturePad.clear();
    });
    // --- SELESAI BAGIAN TANDA TANGAN ---


    // Set nilai default input tanggal ke hari ini
    const tanggalInput = document.getElementById('tanggal');
    if (tanggalInput) {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
        tanggalInput.value = localISOTime.split('T')[0];
    }

    // Tombol untuk konfirmasi
    const btnKirim = document.getElementById('btn-kirim');

    if (btnKirim) {
        btnKirim.addEventListener('click', () => processAttendance());
    }

    async function processAttendance() {
        if (isWeekend) return;
        
        // Pastikan form sudah diisi semua (validasi bawaan HTML5)
        if (!form.reportValidity()) return;

        const kota = document.getElementById('kota').value.trim();
        const namaWalikota = document.getElementById('nama-walikota').value.trim();
        const namaAjudan = document.getElementById('nama-ajudan').value.trim();
        const kehadiranOpd = document.getElementById('kehadiran-opd').value.trim();
        const email = document.getElementById('email').value.trim();
        const noHp = document.getElementById('nohp').value.trim();
        const status = 'Hadir';
        
        // Gunakan tanggal yang dipilih user
        const realTanggal = document.getElementById('tanggal').value;

        if (!kota || !namaWalikota || !namaAjudan || !kehadiranOpd || !email || !noHp || !realTanggal) {
            showAlert('Silakan lengkapi semua data profil.', 'error');
            return;
        }

        if (signaturePad.isEmpty()) {
            showAlert('Silakan isi Tanda Tangan Anda.', 'error');
            return;
        }

        const signatureBase64 = signaturePad.toDataURL('image/png');

        const activeBtn = btnKirim;
        const originalText = activeBtn.textContent;
        activeBtn.disabled = true;
        activeBtn.textContent = 'Memproses...';

        try {
            // Cek apakah sudah absen masuk di tanggal real-time ini dengan NIP ini
            const q = query(collection(db, "riwayat_absensi"), where("kota", "==", kota), where("tanggal", "==", realTanggal));
            const querySnapshot = await getDocs(q);
            
            const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            if (!querySnapshot.empty) {
                showAlert(`Kota ${kota} sudah melakukan konfirmasi kehadiran untuk tanggal tersebut.`, 'error');
            } else {
                await addDoc(collection(db, "riwayat_absensi"), {
                    kota: kota,
                    namaWalikota: namaWalikota,
                    namaAjudan: namaAjudan,
                    kehadiranOpd: kehadiranOpd,
                    email: email,
                    noHp: noHp,
                    ttd: signatureBase64,
                    status: status,
                    tanggal: realTanggal,
                    jamKonfirmasi: currentTime,
                    createdAt: new Date().toISOString()
                });
                showAlert('Konfirmasi kehadiran berhasil disimpan.', 'success');
                form.reset();
                resetDate();
                document.getElementById('btn-clear-signature').click(); // Reset ttd
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('Terjadi kesalahan saat memproses data.', 'error');
        } finally {
            activeBtn.disabled = false;
            activeBtn.textContent = originalText;
        }
    }

    function resetDate() {
        if (tanggalInput) {
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            tanggalInput.value = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
        }
    }

    function showAlert(message, type) {
        alert(message);
    }

    function disableForm() {
        const walikotaInput = document.getElementById('nama-walikota');
        if (walikotaInput) walikotaInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
    }
});
