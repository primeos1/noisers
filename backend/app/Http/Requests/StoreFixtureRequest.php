<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFixtureRequest extends FormRequest
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
            'season_id' => ['required', 'exists:seasons,id'],
            'opponent' => ['required', 'string', 'max:255'],
            'competition' => ['required', 'string', 'max:255'],
            'kickoff_at' => ['required', 'date'],
            'venue' => ['required', 'in:Home,Away'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'in:scheduled,completed,postponed,cancelled'],
            'score_for' => ['nullable', 'integer', 'min:0'],
            'score_against' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
