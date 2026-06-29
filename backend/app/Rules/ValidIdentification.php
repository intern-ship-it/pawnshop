<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates a customer's identification number against its type.
 *
 * - mykad:    exactly 12 digits encoding a real YYMMDD date of birth
 *             (dashes/spaces are ignored)
 * - passport: 5-15 alphanumeric characters
 * - other:    any non-empty value
 *
 * Single source of truth for IC/passport format rules on the server, mirroring
 * the frontend validators in resources/../utils/validators.js.
 */
class ValidIdentification implements ValidationRule
{
    public function __construct(private string $icType = 'mykad')
    {
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $value = (string) $value;

        if ($this->icType === 'passport') {
            if (!preg_match('/^[A-Z0-9]{5,15}$/i', trim($value))) {
                $fail('Passport must be 5-15 alphanumeric characters.');
            }
            return;
        }

        if ($this->icType === 'mykad') {
            $clean = preg_replace('/[-\s]/', '', $value);

            if (!preg_match('/^\d{12}$/', $clean)) {
                $fail('Malaysian IC number must be exactly 12 digits.');
                return;
            }

            if (!$this->isValidIcDate($clean)) {
                $fail('IC number contains an invalid date of birth.');
            }
            return;
        }

        // 'other' — no enforceable format; just require a value
        if (trim($value) === '') {
            $fail('Identification number is required.');
        }
    }

    /**
     * Verify the first 6 digits (YYMMDD) form a real calendar date,
     * rejecting impossible dates like Feb 30 or Apr 31.
     */
    private function isValidIcDate(string $clean): bool
    {
        $yy = (int) substr($clean, 0, 2);
        $month = (int) substr($clean, 2, 2);
        $day = (int) substr($clean, 4, 2);

        // 00-30 => 2000s, 31-99 => 1900s (matches frontend century logic)
        $year = $yy <= 30 ? 2000 + $yy : 1900 + $yy;

        return checkdate($month, $day, $year);
    }
}
