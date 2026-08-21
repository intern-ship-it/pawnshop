<?php

namespace Database\Seeders;

use App\Models\WhatsAppTemplate;
use Illuminate\Database\Seeder;

class WhatsAppTemplateSeeder extends Seeder
{
    /**
     * The message bodies, mirroring the Meta-approved paja_* templates on the
     * WhatsApp gateway.
     *
     * On the gateway (and on AiSensy) this text is never transmitted — the
     * provider renders its own approved template — but it is what staff see in
     * Settings, so it has to match or the preview misleads them. On UltraMsg it
     * IS the message that goes out.
     *
     * Exposed as a static so the migration that refreshes existing rows can
     * reuse it rather than carrying a second copy of every body.
     */
    public static function templates(): array
    {
        return [
            [
                'template_key' => 'pledge_created',
                'name' => 'Pledge Created',
                'content' => <<<TEXT
                DSARA ASSET VENTURES SDN BHD

                🏦 PLEDGE RECEIPT
                ━━━━━━━━━━━━━━━━

                📋 PLEDGE NO : {pledge_no}
                📅 DATE : {date}

                CUSTOMER : {customer_name}
                IC : {customer_ic}

                📦 ITEMS :
                {items}

                ⚖️ TOTAL WEIGHT : {total_weight}G
                💰 LOAN AMOUNT : RM {loan_amount}
                📊 INTEREST : {interest_rate}% / MONTH

                📅 DUE DATE : {due_date}

                ━━━━━━━━━━━━━━━━
                THANK YOU FOR YOUR BUSINESS!
                TEXT,
                'variables' => ['pledge_no', 'date', 'customer_name', 'customer_ic', 'items', 'total_weight', 'loan_amount', 'interest_rate', 'due_date'],
            ],
            [
                'template_key' => 'renewal_completed',
                'name' => 'Renewal Completed',
                'content' => <<<TEXT
                DSARA ASSET VENTURES SDN BHD

                🏦 RENEWAL RECEIPT
                ━━━━━━━━━━━━━━━━

                📋 RENEWAL NO : {renewal_no}
                🔖 PLEDGE NO : {pledge_no}
                📅 DATE : {date}

                CUSTOMER : {customer_name}
                IC : {customer_ic}

                💰 LOAN AMOUNT : RM {loan_amount}
                ⏱️ EXTENDED : {extended} MONTH(S)
                💵 TOTAL PAID : RM {total_paid}

                📅 NEW DUE DATE : {new_due_date}

                ━━━━━━━━━━━━━━━━
                THANK YOU FOR YOUR BUSINESS!
                TEXT,
                'variables' => ['renewal_no', 'pledge_no', 'date', 'customer_name', 'customer_ic', 'loan_amount', 'extended', 'total_paid', 'new_due_date'],
            ],
            [
                'template_key' => 'redemption_completed',
                'name' => 'Redemption Completed',
                'content' => <<<TEXT
                DSARA ASSET VENTURES SDN BHD

                ✅ REDEMPTION RECEIPT
                ━━━━━━━━━━━━━━━━

                📋 REDEMPTION NO : {redemption_no}
                📋 PLEDGE NO : {pledge_no}
                📅 DATE : {date}

                CUSTOMER : {customer_name}
                IC : {customer_ic}

                📦 ITEMS RELEASED :
                {items_released}

                💰 PRINCIPAL : RM {principal}
                📊 INTEREST : RM {interest}
                💵 TOTAL PAID : RM {total_paid}

                💳 PAYMENT MODE : {payment_mode}
                💵 AMOUNT PAID : RM {amount_paid}

                ━━━━━━━━━━━━━━━━
                YOUR ITEMS HAVE BEEN RELEASED.
                THANK YOU FOR YOUR BUSINESS!
                TEXT,
                'variables' => ['redemption_no', 'pledge_no', 'date', 'customer_name', 'customer_ic', 'items_released', 'principal', 'interest', 'total_paid', 'payment_mode', 'amount_paid'],
            ],
            [
                'template_key' => 'reminder_7days',
                'name' => '7 Days Reminder',
                'content' => self::reminderBody('7 DAYS REMAINING'),
                'variables' => self::REMINDER_VARIABLES,
            ],
            [
                'template_key' => 'reminder_3days',
                'name' => '3 Days Reminder',
                'content' => self::reminderBody('3 DAYS REMAINING'),
                'variables' => self::REMINDER_VARIABLES,
            ],
            [
                'template_key' => 'reminder_1day',
                'name' => '1 Day Reminder',
                'content' => self::reminderBody('DUE TOMORROW'),
                'variables' => self::REMINDER_VARIABLES,
            ],
            [
                'template_key' => 'overdue_notice',
                'name' => 'Overdue Notice',
                'content' => <<<TEXT
                DSARA ASSET VENTURES SDN BHD

                ⚠️ OVERDUE NOTICE
                ━━━━━━━━━━━━━━━━

                📋 PLEDGE NO : {pledge_no}

                CUSTOMER : {customer_name}

                💰 LOAN AMOUNT : RM {loan_amount}
                📅 DUE DATE : {due_date}
                ⏱️ DAYS OVERDUE : {overdue_days}

                📊 INTEREST DUE : RM {overdue_interest}
                💵 TOTAL TO REDEEM : RM {redemption_amount}

                ━━━━━━━━━━━━━━━━
                YOUR PLEDGE IS PAST ITS DUE DATE.
                PLEASE RENEW OR REDEEM AS SOON AS POSSIBLE TO AVOID AUCTION.

                📞 CONTACT ADMIN : +60 12 694 5430
                FOR ANY QUERIES, PLEASE CONTACT THE ABOVE NUMBER.
                TEXT,
                'variables' => ['pledge_no', 'customer_name', 'loan_amount', 'due_date', 'overdue_days', 'overdue_interest', 'redemption_amount'],
            ],
            [
                'template_key' => 'auction_notice',
                'name' => 'Auction Notice',
                // The auction date and reserve price live on the auction record
                // and are not passed to the WhatsApp job, so they are deliberately
                // absent here — a blank parameter fails the send outright.
                'content' => <<<TEXT
                DSARA ASSET VENTURES SDN BHD

                🔨 AUCTION NOTICE
                ━━━━━━━━━━━━━━━━

                📋 PLEDGE NO : {pledge_no}

                CUSTOMER : {customer_name}

                💰 LOAN AMOUNT : RM {loan_amount}
                📅 DUE DATE : {due_date}
                ⏱️ DAYS OVERDUE : {overdue_days}

                💵 TOTAL TO REDEEM : RM {redemption_amount}

                ━━━━━━━━━━━━━━━━
                YOUR PLEDGED ITEMS ARE SCHEDULED FOR AUCTION.
                PLEASE REDEEM YOUR ITEMS IMMEDIATELY TO AVOID LOSS.

                📞 CONTACT ADMIN : +60 12 694 5430
                FOR ANY QUERIES, PLEASE CONTACT THE ABOVE NUMBER.
                TEXT,
                'variables' => ['pledge_no', 'customer_name', 'loan_amount', 'due_date', 'overdue_days', 'redemption_amount'],
            ],
        ];
    }

    /** Every reminder differs only in its countdown line. */
    private const REMINDER_VARIABLES = [
        'pledge_no', 'customer_name', 'loan_amount', 'current_interest', 'redemption_amount', 'due_date',
    ];

    private static function reminderBody(string $countdown): string
    {
        return <<<TEXT
        DSARA ASSET VENTURES SDN BHD

        ⏰ PAYMENT REMINDER
        ━━━━━━━━━━━━━━━━

        📋 PLEDGE NO : {pledge_no}

        CUSTOMER : {customer_name}

        💰 LOAN AMOUNT : RM {loan_amount}
        📊 INTEREST DUE : RM {current_interest}
        💵 TOTAL TO REDEEM : RM {redemption_amount}

        📅 DUE DATE : {due_date}
        ⏳ {$countdown}

        ━━━━━━━━━━━━━━━━
        PLEASE RENEW OR REDEEM BEFORE THE DUE DATE.

        📞 CONTACT ADMIN : +60 12 694 5430
        FOR ANY QUERIES, PLEASE CONTACT THE ABOVE NUMBER.
        TEXT;
    }

    public function run(): void
    {
        foreach (self::templates() as $template) {
            // Keyed so re-running refreshes the global rows instead of creating
            // a duplicate set. Branch overrides are left to the migration.
            WhatsAppTemplate::updateOrCreate(
                ['branch_id' => null, 'template_key' => $template['template_key']],
                [
                    'name' => $template['name'],
                    'content' => $template['content'],
                    'variables' => $template['variables'],
                ]
            );
        }
    }
}
