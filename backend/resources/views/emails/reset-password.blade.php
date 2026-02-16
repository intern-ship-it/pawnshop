<x-mail::message>
    # Reset Your Password

    Hello **{{ $user->name }}**,

    We received a request to reset the password for your PawnSys account associated with **{{ $user->email }}**.

    Click the button below to set a new password:

    <x-mail::button :url="$resetUrl" color="primary">
        Reset Password
    </x-mail::button>

    **This link will expire in {{ $expiresInMinutes }} minutes.** If you did not request a password reset, no action is
    needed — your account remains secure.

    ---

    **Having trouble?** If the button above doesn't work, copy and paste the following URL into your browser:

    <small>{{ $resetUrl }}</small>

    ---

    **Security Tips:**
    - Never share your password or reset link with anyone.
    - PawnSys staff will never ask for your password.
    - If you suspect unauthorized access, contact your administrator immediately.

    Thanks,<br>
    **{{ config('app.name') }}**

    <small style="color: #999;">
        This is an automated email from {{ config('app.name') }}. Please do not reply to this email.
        If you did not request this password reset, you can safely ignore this message.
    </small>
</x-mail::message>