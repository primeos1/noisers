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
            'number' => ['required', 'integer', 'min:1', 'max:99', 'unique:players,number'],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['required', 'in:GK,DEF,MID,FWD'],
            'rating' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'bio' => ['nullable', 'string'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo_url' => ['nullable', 'url', 'max:2048'],
            'active' => ['boolean'],
        ];
    }
}
