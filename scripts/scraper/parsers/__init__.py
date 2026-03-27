"""HTML parsers for different blog platforms."""

from .wordpress_thirstypig import WordPressThirstyPigParser
from .wordpress_thethirstypig import WordPressTheThirstyPigParser
from .blogspot import BlogspotParser

PARSERS = {
    'wordpress_thirstypig': WordPressThirstyPigParser(),
    'wordpress_thethirstypig': WordPressTheThirstyPigParser(),
    'blogspot': BlogspotParser(),
}


def get_parser(parser_name: str):
    """Get a parser instance by name."""
    return PARSERS.get(parser_name)
