<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'number' => ['sometimes', 'required', 'integer', 'min:1', 'max:99', Rule::unique('players', 'number')->ignore($this->route('player'))],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'position' => ['sometimes', 'required', 'in:GK,DEF,MID,FWD'],
            'bio' => ['nullable', 'string'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo_url' => ['nullable', 'url', 'max:2048'],
            'active' => ['boolean'],
        ];
    }
}
