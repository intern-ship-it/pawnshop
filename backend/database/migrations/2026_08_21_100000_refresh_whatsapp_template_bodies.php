<?php

use App\Models\WhatsAppTemplate;
use Database\Seeders\WhatsAppTemplateSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Bring the stored message bodies in line with the Meta-approved paja_*
     * templates on the WhatsApp gateway.
     *
     * The rows still held the original Malay seeder text, which no provider
     * sends any more but which Settings still displays — so staff were reading
     * one message while customers received another. The gateway textarea is
     * hidden for template-mapping providers, so this cannot be corrected from
     * the UI and has to be done here.
     *
     * Updates every row per key, global and branch overrides alike, and touches
     * only content/variables: the campaign mapping each branch has already
     * entered is left untouched.
     */
    public function up(): void
    {
        foreach (WhatsAppTemplateSeeder::templates() as $template) {
            WhatsAppTemplate::where('template_key', $template['template_key'])
                ->get()
                ->each(function (WhatsAppTemplate $row) use ($template) {
                    $row->update([
                        'content' => $template['content'],
                        'variables' => $template['variables'],
                    ]);
                });
        }
    }

    public function down(): void
    {
        // No rollback: the previous bodies were superseded copy, not schema,
        // and restoring them would put misleading text back in front of staff.
    }
};
