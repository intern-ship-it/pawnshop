<?php

namespace Database\Seeders;

use App\Models\TermsCondition;
use Illuminate\Database\Seeder;

class TermsConditionSeeder extends Seeder
{
    public function run(): void
    {
        // Clear existing terms first (optional - comment out if you want to keep existing)
        // TermsCondition::truncate();

        // These are the exact 12 KPKT-compliant T&C from standard pawn receipts
        // sort_order determines the display sequence on receipts
        $terms = [
            [
                'activity_type' => 'pledge',
                'title' => 'Salinan Tiket Pajak Gadai',
                'content_ms' => 'Seseorang pemajak gadai adalah berhak mendapat satu salinan tiket pajak gadai pada masa pajak gadaian. Jika hilang, satu salinan catatan di dalam buku pemegang pajak gadai boleh diberi dengan percuma.',
                'content_en' => 'A pledger is entitled to receive a copy of the pawn ticket at the time of pledge. If lost, a copy from the pawnbroker\'s record book may be given free of charge.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => true,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Kadar Keuntungan',
                'content_ms' => 'Kadar untung adalah tidak melebihi dua peratus (2%) sebulan atau sebahagian daripadanya campur caj pengendalian sebanyak lima puluh sen (50¢) bagi mana-mana pinjaman yang melebihi sepuluh ringgit.',
                'content_en' => 'The profit rate shall not exceed two percent (2%) per month or part thereof, plus a handling charge of fifty cents (50¢) for any loan exceeding ten ringgit.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Pampasan Kehilangan/Kemusnahan',
                'content_ms' => 'Jika mana-mana sandaran hilang atau musnah disebabkan atau dalam kebakaran, kecuaian, kecurian, rompakan atau selainnya, maka amoun pampasan adalah satu per empat (25%) lebih daripada jumlah pinjaman.',
                'content_en' => 'If any pledge is lost or destroyed due to fire, negligence, theft, robbery or otherwise, the compensation amount shall be one quarter (25%) more than the loan amount.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Tempoh Penebusan',
                'content_ms' => 'Mana-mana sandaran hendaklah ditebus dalam masa enam bulan dari tarikh pajak gadaian atau dalam masa yang lebih panjang sebagaimana yang dipersetujui antara pemegang pajak gadai dengan pemajak gadai.',
                'content_en' => 'Any pledge must be redeemed within six months from the date of pledge or within a longer period as agreed between the pawnbroker and the pledger.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => true,
                'is_active' => true,
                'sort_order' => 4,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Hak Pemeriksaan Lelongan',
                'content_ms' => 'Seorang pemajak gadai berhak pada bila-bila masa dalam masa empat bulan selepas lelong untuk memeriksa catatan jualan dalam buku pemegang pajak gadai dan laporan yang dibuat oleh pelelong.',
                'content_en' => 'A pledger has the right at any time within four months after auction to inspect the sales records in the pawnbroker\'s book and the report made by the auctioneer.',
                'print_with_receipt' => true,
                'require_consent' => false,
                'show_on_screen' => false,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 5,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Pertanyaan KPKT',
                'content_ms' => 'Apa-apa pertanyaan boleh dialamatkan kepada: Pendaftar Pemegang Pajak Gadai, Kementerian Perumahan dan Kerajaan Tempatan, Aras 22, No 51, Jalan Persiaran Perdana, Presint 4, 62100 Putrajaya.',
                'content_en' => 'Any enquiries may be addressed to: Registrar of Pawnbrokers, Ministry of Housing and Local Government, Level 22, No 51, Jalan Persiaran Perdana, Precinct 4, 62100 Putrajaya.',
                'print_with_receipt' => true,
                'require_consent' => false,
                'show_on_screen' => false,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 6,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Pelupusan Sandaran',
                'content_ms' => 'Jika sesuatu sandaran tidak ditebus di dalam enam bulan maka sandaran itu: (a) Jika dipajak gadai untuk wang berjumlah dua ratus ringgit dan ke bawah, hendaklah menjadi harta pemegang pajak gadai itu. (b) Jika dipajak gadai untuk wang berjumlah lebih daripada dua ratus ringgit hendaklah dijual oleh seorang pelelong berlesen mengikut Akta Pelelongan.',
                'content_en' => 'If a pledge is not redeemed within six months: (a) If pledged for two hundred ringgit or below, it shall become the property of the pawnbroker. (b) If pledged for more than two hundred ringgit, it shall be sold by a licensed auctioneer according to the Auction Act.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 7,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Surat Berdaftar',
                'content_ms' => 'Jika mana-mana surat berdaftar tidak sampai kepada pemajak gadai pejabat adalah tanggungjawab pejabat pos dan bukan pemegang pajak gadai.',
                'content_en' => 'If any registered mail does not reach the pledger, it is the responsibility of the post office and not the pawnbroker.',
                'print_with_receipt' => true,
                'require_consent' => false,
                'show_on_screen' => false,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 8,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Perubahan Alamat',
                'content_ms' => 'Sila maklumkan kami jika sekiranya anda menukarkan alamat.',
                'content_en' => 'Please notify us if you change your address.',
                'print_with_receipt' => true,
                'require_consent' => false,
                'show_on_screen' => false,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 9,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Tarikh Tamat Tempoh Cuti Am',
                'content_ms' => 'Jika tarikh tamat tempoh jatuh pada Cuti Am anda dinasihatkan datang menebus/melanjut sebelum Cuti Am.',
                'content_en' => 'If the expiry date falls on a Public Holiday, you are advised to redeem/renew before the Public Holiday.',
                'print_with_receipt' => true,
                'require_consent' => false,
                'show_on_screen' => true,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 10,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Barang Curian',
                'content_ms' => 'Barang-barang curian tidak diterima.',
                'content_en' => 'Stolen goods are not accepted.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 11,
            ],
            [
                'activity_type' => 'pledge',
                'title' => 'Perlindungan Data Peribadi',
                'content_ms' => 'Data peribadi anda akan digunakan dan diproseskan hanya bagi tujuan internal sahaja.',
                'content_en' => 'Your personal data will be used and processed for internal purposes only.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => false,
                'is_active' => true,
                'sort_order' => 12,
            ],

            // ==================
            // RENEWAL T&C
            // ==================
            [
                'activity_type' => 'renewal',
                'title' => 'Syarat Pembaharuan',
                'content_ms' => 'Pembaharuan gadaian boleh dibuat dengan membayar faedah terkumpul. Tempoh gadaian baharu bermula dari tarikh pembaharuan.',
                'content_en' => 'Pledge renewal can be made by paying the accumulated interest. The new pledge period starts from the renewal date.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => true,
                'is_active' => true,
                'sort_order' => 1,
            ],

            // ==================
            // REDEMPTION T&C
            // ==================
            [
                'activity_type' => 'redemption',
                'title' => 'Syarat Penebusan',
                'content_ms' => 'Dikehendaki membawa kad pengenalan apabila menebus barang gadaian.',
                'content_en' => 'You are required to bring your identification card when redeeming pledged items.',
                'print_with_receipt' => true,
                'require_consent' => true,
                'show_on_screen' => true,
                'attach_to_whatsapp' => true,
                'is_active' => true,
                'sort_order' => 1,
            ],
        ];

        foreach ($terms as $term) {
            TermsCondition::create($term);
        }
    }
}
