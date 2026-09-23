<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAssistEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'player_id' => ['required', 'exists:players,id'],
            'fixture_id' => ['required', 'exists:fixtures,id'],
            'goal_event_id' => ['nullable', 'exists:goal_events,id'],
            'minute' => ['nullable', 'integer', 'min:0', 'max:255'],
        ];
    }
}
