<?php

namespace App\Mail;

use App\Models\SubscriptionIntent;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SubscriptionIntentCreated extends Mailable
{
    use Queueable, SerializesModels;

    public SubscriptionIntent $intent;

    public function __construct(SubscriptionIntent $intent)
    {
        $this->intent = $intent->load('user');
    }

    public function build()
    {
        $subject = 'Tu selección de plan en Guro';
        return $this->subject($subject)
            ->view('emails.subscription_intent')
            ->with([
                'intent' => $this->intent,
            ]);
    }
}


