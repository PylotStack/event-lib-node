import { defineEventStack } from "../../src";


export const personMovieRentals = defineEventStack("personMovieRentals")
    .action("RENT_MOVIE", (ctx, { movieName }) => {
        return ctx.commit();
    })
    .action("RETURN_MOVIE", (ctx, { movieName }) => {
        return ctx.commit();
    });


export const currentlyRentedMoviesView = personMovieRentals
    .createView("currentlyRentedMovies", { movies: [] })
    .event("RENT_MOVIE", (state, ev) => {
        return {
            ...state,
            movies: [...state.movies, ev.payload.movieName],
        };
    })
    .event("RETURN_MOVIE", (state, ev) => {
        return {
            ...state,
            movies: state.movies.filter(movieName => movieName !== ev.payload.movieName),
        };
    });

export const personMovieRentalsModel = personMovieRentals
    .mapModel((ctx) => {
        return {
            currentlyRentedMovies: ctx.mapView(currentlyRentedMoviesView.definition, "movies"),
            rentMovie: ctx.mapAction("RENT_MOVIE", (movieName) => ({ movieName })),
            returnMovie: ctx.mapAction("RETURN_MOVIE", (movieName) => ({ movieName })),
        };
    });
