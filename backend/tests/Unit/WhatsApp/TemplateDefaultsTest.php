<?php

namespace Tests\Unit\WhatsApp;

use Database\Seeders\WhatsAppTemplateSeeder;
use Tests\TestCase;

/**
 * The seeder's template definitions are the source the gateway mapping is
 * applied from, so a missing campaign name or a parameter list that does not
 * match the body silently produces a send Meta rejects — after the gateway has
 * charged the wallet.
 */
class TemplateDefaultsTest extends TestCase
{
    public function test_every_template_declares_a_gateway_campaign(): void
    {
        foreach (WhatsAppTemplateSeeder::templates() as $template) {
            $this->assertNotEmpty(
                $template['campaign'] ?? null,
                "Template {$template['template_key']} has no gateway campaign name"
            );
        }
    }

    public function test_every_parameter_appears_in_its_message_body(): void
    {
        foreach (WhatsAppTemplateSeeder::templates() as $template) {
            foreach ($template['variables'] as $variable) {
                $this->assertStringContainsString(
                    '{' . $variable . '}',
                    $template['content'],
                    "Template {$template['template_key']} maps {$variable} but never uses it"
                );
            }
        }
    }

    public function test_parameter_lists_have_no_duplicates(): void
    {
        foreach (WhatsAppTemplateSeeder::templates() as $template) {
            $this->assertSame(
                array_values(array_unique($template['variables'])),
                array_values($template['variables']),
                "Template {$template['template_key']} repeats a parameter"
            );
        }
    }

    public function test_reminder_templates_share_one_parameter_list(): void
    {
        $reminders = collect(WhatsAppTemplateSeeder::templates())
            ->filter(fn ($t) => str_starts_with($t['template_key'], 'reminder_'))
            ->pluck('variables');

        $this->assertCount(3, $reminders);
        $this->assertCount(1, $reminders->unique(fn ($v) => implode(',', $v)));
    }
}
