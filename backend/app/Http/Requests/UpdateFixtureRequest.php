<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFixtureRequest extends FormRequest
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
            'season_id' => ['sometimes', 'required', 'exists:seasons,id'],
            'opponent' => ['sometimes', 'required', 'string', 'max:255'],
            'competition' => ['sometimes', 'required', 'string', 'max:255'],
            'kickoff_at' => ['sometimes', 'required', 'date'],
            'venue' => ['sometimes', 'required', 'in:Home,Away'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'in:scheduled,completed,postponed,cancelled'],
            'score_for' => ['nullable', 'integer', 'min:0'],
            'score_against' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
