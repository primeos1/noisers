<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCardRequest extends FormRequest
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
            'player_number' => ['required', 'exists:players,number'],
            'type' => ['required', 'in:yellow,red'],
            'reason' => ['nullable', 'string', 'max:255'],
            'fine_amount' => ['required', 'numeric', 'min:0'],
            'paid' => ['boolean'],
            'occurred_on' => ['nullable', 'date'],
        ];
    }
}
