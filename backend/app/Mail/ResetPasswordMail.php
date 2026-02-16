<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ResetPasswordMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $token;
    public $user;
    public string $resetUrl;

    /**
     * Create a new message instance.
     */
    public function __construct(string $token, $user)
    {
        $this->token = $token;
        $this->user = $user;
        $this->resetUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173'))
            . '/reset-password?token=' . $token;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset Your Password - PawnSys',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'emails.reset-password',
            with: [
                'resetUrl' => $this->resetUrl,
                'user' => $this->user,
                'token' => $this->token,
                'expiresInMinutes' => 60,
            ],
        );
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        return [];
    }
}
