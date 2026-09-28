<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Executive extends Model
{
    protected $fillable = [
        'name',
        'title',
        'photo_url',
        'sort_order',
    ];
}
