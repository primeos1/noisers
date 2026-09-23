<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Highlight extends Model
{
    protected $fillable = [
        'type',
        'media_url',
        'alt',
        'caption',
        'category',
        'occurred_on',
        'tall',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'occurred_on' => 'date',
            'tall' => 'boolean',
        ];
    }
}
