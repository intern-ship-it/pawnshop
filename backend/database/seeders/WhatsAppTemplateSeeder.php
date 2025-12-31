<?php

namespace Database\Seeders;

use App\Models\WhatsAppTemplate;
use Illuminate\Database\Seeder;

class WhatsAppTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            [
                'template_key' => 'pledge_created',
                'name' => 'Pledge Created',
                'content' => "Assalamualaikum {customer_name},\n\nTerima kasih kerana berurusan dengan {company_name}.\n\nNo. Resit: {receipt_no}\nJumlah Pinjaman: RM {loan_amount}\nTarikh Tamat: {due_date}\n\nSila simpan resit anda dengan selamat.\n\nTerima kasih.",
                'variables' => json_encode(['customer_name', 'company_name', 'receipt_no', 'loan_amount', 'due_date']),
            ],
            [
                'template_key' => 'renewal_completed',
                'name' => 'Renewal Completed',
                'content' => "Assalamualaikum {customer_name},\n\nPembaharuan gadaian anda telah berjaya.\n\nNo. Resit: {receipt_no}\nTempoh: {renewal_months} bulan\nFaedah Dibayar: RM {interest_amount}\nTarikh Tamat Baru: {new_due_date}\n\nTerima kasih.",
                'variables' => json_encode(['customer_name', 'receipt_no', 'renewal_months', 'interest_amount', 'new_due_date']),
            ],
            [
                'template_key' => 'redemption_completed',
                'name' => 'Redemption Completed',
                'content' => "Assalamualaikum {customer_name},\n\nPenebusan gadaian anda telah selesai.\n\nNo. Resit: {receipt_no}\nJumlah Dibayar: RM {total_amount}\n\nBarang anda telah dikembalikan.\n\nTerima kasih kerana berurusan dengan kami.",
                'variables' => json_encode(['customer_name', 'receipt_no', 'total_amount']),
            ],
            [
                'template_key' => 'reminder_7days',
                'name' => '7 Days Reminder',
                'content' => "Assalamualaikum {customer_name},\n\nIni adalah peringatan bahawa gadaian anda akan tamat dalam 7 hari.\n\nNo. Resit: {receipt_no}\nTarikh Tamat: {due_date}\nFaedah Semasa: RM {current_interest}\n\nSila hubungi kami untuk pembaharuan atau penebusan.\n\nTerima kasih.",
                'variables' => json_encode(['customer_name', 'receipt_no', 'due_date', 'current_interest']),
            ],
            [
                'template_key' => 'reminder_3days',
                'name' => '3 Days Reminder',
                'content' => "Assalamualaikum {customer_name},\n\nPERINGATAN: Gadaian anda akan tamat dalam 3 hari!\n\nNo. Resit: {receipt_no}\nTarikh Tamat: {due_date}\nFaedah Semasa: RM {current_interest}\n\nSila ambil tindakan segera.\n\nTerima kasih.",
                'variables' => json_encode(['customer_name', 'receipt_no', 'due_date', 'current_interest']),
            ],
            [
                'template_key' => 'reminder_1day',
                'name' => '1 Day Reminder',
                'content' => "Assalamualaikum {customer_name},\n\nPERINGATAN AKHIR: Gadaian anda akan tamat ESOK!\n\nNo. Resit: {receipt_no}\nTarikh Tamat: {due_date}\nFaedah Semasa: RM {current_interest}\n\nSila hubungi kami hari ini.\n\nTerima kasih.",
                'variables' => json_encode(['customer_name', 'receipt_no', 'due_date', 'current_interest']),
            ],
            [
                'template_key' => 'overdue_notice',
                'name' => 'Overdue Notice',
                'content' => "Assalamualaikum {customer_name},\n\nNOTIS: Gadaian anda telah TAMAT TEMPOH.\n\nNo. Resit: {receipt_no}\nTarikh Tamat: {due_date}\nHari Tertunggak: {overdue_days} hari\nFaedah Tertunggak: RM {overdue_interest}\n\nTempoh ihsan 7 hari dari tarikh tamat.\nSila hubungi kami segera untuk mengelakkan lelongan.\n\nTerima kasih.",
                'variables' => json_encode(['customer_name', 'receipt_no', 'due_date', 'overdue_days', 'overdue_interest']),
            ],
            [
                'template_key' => 'auction_notice',
                'name' => 'Auction Notice',
                'content' => "Assalamualaikum {customer_name},\n\nNOTIS LELONGAN: Barangan gadaian anda akan dilelong.\n\nNo. Resit: {receipt_no}\nTarikh Lelongan: {auction_date}\nHarga Rizab: RM {reserve_price}\n\nSila tebus barang anda sebelum tarikh lelongan.\n\nTerima kasih.",
                'variables' => json_encode(['customer_name', 'receipt_no', 'auction_date', 'reserve_price']),
            ],
        ];

        foreach ($templates as $template) {
            WhatsAppTemplate::create($template);
        }
    }
}
