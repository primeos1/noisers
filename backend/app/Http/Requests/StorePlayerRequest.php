<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePlayerRequest extends FormRequest
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
            'number' => ['required', 'integer', 'min:1', 'max:99'],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['required', 'in:GK,DEF,MID,FWD'],
            'secondary_position' => ['nullable', 'in:GK,DEF,MID,FWD', 'different:position'],
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
