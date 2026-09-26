<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePlayerRequest extends FormRequest
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
            'number' => ['sometimes', 'required', 'integer', 'min:1', 'max:99'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'position' => ['sometimes', 'required', 'in:GK,DEF,MID,FWD'],
            'secondary_position' => ['nullable', 'in:GK,DEF,MID,FWD'],
            'rating' => ['nullable', 'numeric', 'min:4', 'max:9.5'],
            'membership' => ['sometimes', 'in:member,guest'],
            'bio' => ['nullable', 'string'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo_url' => ['nullable', 'url', 'max:2048'],
            'active' => ['boolean'],
        ];
    }
}
