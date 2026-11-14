<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FnlTeam extends Model
{
    protected $table = 'fnl_teams';

    protected $fillable = ['player_id', 'name'];

    protected function casts(): array
    {
        return ['player_id' => 'integer'];
    }

    public function entries()
    {
        return $this->hasMany(FnlEntry::class);
    }

    public function leagues()
    {
        return $this->belongsToMany(FnlLeague::class, 'fnl_league_members');
    }
}
