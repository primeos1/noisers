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
            'player_id' => ['required', 'exists:players,id'],
            'fixture_id' => ['required', 'exists:fixtures,id'],
            'type' => ['required', 'in:yellow,red'],
            'fine_amount' => ['required', 'numeric', 'min:0'],
            'paid' => ['boolean'],
        ];
    }
}
