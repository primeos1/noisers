<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Executive extends Model
{
    public const GROUPS = ['executive', 'staff', 'disciplinary'];

    protected $fillable = [
        'name',
        'title',
        'group',
        'photo_url',
        'sort_order',
    ];
}
