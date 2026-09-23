<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGoalEventRequest extends FormRequest
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
            'minute' => ['nullable', 'integer', 'min:0', 'max:255'],
        ];
    }
}
