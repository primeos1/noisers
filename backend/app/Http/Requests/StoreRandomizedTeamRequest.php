<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRandomizedTeamRequest extends FormRequest
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
            'training_session_id' => ['required', 'exists:training_sessions,id'],
            'player_ids' => ['required', 'array', 'min:2'],
            'player_ids.*' => ['integer', 'exists:players,id'],
            'team_count' => ['sometimes', 'integer', 'min:2', 'max:4'],
            'balance_by_position' => ['sometimes', 'boolean'],
        ];
    }
}
