<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HomeContent extends Model
{
    protected $table = 'home_content';

    protected $fillable = [
        'hero_eyebrow',
        'hero_headline',
        'hero_subtext',
        'hero_image_url',
        'story_eyebrow',
        'story_headline',
        'story_paragraph_1',
        'story_paragraph_2',
        'story_image_url',
        'atmosphere_caption',
        'atmosphere_image_url',
        'matchday_eyebrow',
        'matchday_headline',
        'matchday_body',
        'footer_tagline',
        'footer_copyright',
    ];

    /**
     * The site has exactly one Home page content row, created on first use
     * with the copy that used to be hardcoded in the frontend components.
     */
    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], [
            'hero_eyebrow' => 'Est. 2021 · Grassroots five-a-side',
            'hero_headline' => 'Vale to zenith.',
            'hero_subtext' => "Noisers FC is a small-sided club built on the same pitch we still play on. Every set, every card, every goal — logged, tracked and built into a squad that keeps climbing.",
            'story_eyebrow' => 'Our story',
            'story_headline' => 'From the vale, toward the zenith.',
            'story_paragraph_1' => "Noisers FC started in 2021 as a handful of regulars turning up for the same Saturday set. The name on the badge changed, the pitch didn't — and neither did the plan: play hard, look after each other, and keep the standard climbing every season.",
            'story_paragraph_2' => '"Vale 2 Zenith" is the club in one line — grounded where we play, ambitious about where we\'re going. This site is how we run that climb: squad, sets, cards and every goal, all in one place.',
            'atmosphere_caption' => 'Same tunnel, every week.',
            'matchday_eyebrow' => 'How match day works',
            'matchday_headline' => 'No opponent. Just the squad.',
            'matchday_body' => "Every session, whoever's present gets split into balanced six-a-side teams — random, by rating, or by position — then it's first to two goals on a ten-minute clock. Goals, assists and cards all get logged as they happen.",
            'footer_tagline' => 'Est. 2021 · Vale 2 Zenith. Grassroots five-a-side football, run properly.',
            'footer_copyright' => 'Noisers FC. All rights reserved.',
        ]);
    }
}
